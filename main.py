"""
main.py — Moroccan Kitchen AI Terminal App

Usage:
  python main.py                     # interactive mode
  python main.py --user-id ahmed     # specify user
  python main.py --debug             # verbose agent traces

Commands in the chat:
  /preferences    — show your stored preferences
  /history        — show your session history
  /like <dish>    — mark a dish as liked
  /dislike <dish> — mark a dish as disliked
  /diet <flag>    — add a dietary constraint (e.g. /diet vegetarian)
  /reset          — reset preferences
  /clear          — clear conversation history
  /help           — show this help
  exit || quit     — quit the app
"""

import argparse
import sys
import os

from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown
from rich.table import Table
from rich.prompt import Prompt
from rich import box
from rich.text import Text

# Add project root to path
sys.path.insert(0, os.path.dirname(__file__))

from config import settings, validate as validate_settings
from orchestrator import KitchenOrchestrator

console = Console()


def print_banner():
    banner = """[dim]Moroccan Kitchen AI! 
Type [bold]/help[/bold] for commands | [bold]exit[/bold] to quit[/dim]
"""
    console.print(banner)


def print_result(result, debug: bool = False):
    """Pretty-print the KitchenResult to the terminal."""

    # Main response
    console.print()
    console.print(Panel(
        Markdown(result.final_response),
        title="[bold green]🍋 Welcome to CMA [/bold green]",
        border_style="green",
        padding=(1, 2),
    ))

    # Quality indicator
    if result.critic_score is not None:
        score_color = "green" if result.critic_score >= 7 else "yellow" if result.critic_score >= 5 else "red"
        console.print(
            f"[dim]  Quality score: [{score_color}]{result.critic_score}/10[/{score_color}]"
            f"  |  Revision iterations: {result.iteration_count}[/dim]"
        )

    # Nutrition summary
    if result.nutrition:
        n = result.nutrition.get("per_serving", {})
        if n:
            source = result.nutrition.get("data_source", "")
            med_score = result.nutrition.get("mediterranean_score", "")
            table = Table(
                title="Nutrition per serving: ",
                box=box.SIMPLE,
                show_header=True,
                header_style="bold cyan",
            )
            table.add_column("Calories", style="bold")
            table.add_column("Carbs")
            table.add_column("Protein")
            table.add_column("Fat")
            table.add_column("Sugar")
            table.add_column("Fibre")
            table.add_column("Med. score")
            table.add_row(
                f"{n.get('calories', '?')} kcal",
                f"{n.get('carbs_g', '?')} g",
                f"{n.get('protein_g', '?')} g",
                f"{n.get('fat_g', '?')} g",
                f"{n.get('sugar_g', '?')} g",
                f"{n.get('fibre_g', '?')} g",
                f"{med_score}/10" if med_score else "—",
            )
            console.print(table)

    # Debug: show raw agent outputs
    if debug:
        if result.recommended_recipes:
            console.print("[dim][Recommendation agent output][/dim]")
            for r in result.recommended_recipes:
                console.print(f"  • {r.get('name')} — {r.get('difficulty')} — {r.get('time_minutes')} min")
        console.print(f"[dim][Session summary] {result.session_summary}[/dim]")


def handle_command(cmd: str, orchestrator: KitchenOrchestrator) -> bool:
    """Handle slash commands. Returns True if handled, False if unknown."""
    parts = cmd.strip().split(None, 1)
    verb = parts[0].lower()
    arg = parts[1] if len(parts) > 1 else ""

    if verb == "/help":
        console.print(Panel(__doc__, title="Help", border_style="blue"))
        return True

    if verb in ["/preferences", "/pr"]:
        prefs = orchestrator.get_preferences()
        t = Table(title="Your stored preferences", box=box.SIMPLE)
        t.add_column("Category", style="bold")
        t.add_column("Values")
        t.add_row("Liked dishes", ", ".join(prefs.get("liked", [])) or "—")
        t.add_row("Disliked dishes", ", ".join(prefs.get("disliked", [])) or "—")
        t.add_row("Dietary constraints", ", ".join(prefs.get("dietary", [])) or "—")
        t.add_row("Flavor notes", prefs.get("flavor_notes", "") or "—")
        console.print(t)
        return True

    if verb == "/history":
        history = orchestrator.get_history()
        console.print(Panel(history or "No history yet.", title="Session history", border_style="dim"))
        return True

    if verb == "/like" and arg:
        orchestrator.update_preferences(liked=[arg])
        console.print(f"[green]✓ Added '{arg}' to liked dishes[/green]")
        return True

    if verb == "/dislike" and arg:
        orchestrator.update_preferences(disliked=[arg])
        console.print(f"[yellow]✓ Added '{arg}' to disliked dishes[/yellow]")
        return True

    if verb == "/diet" and arg:
        orchestrator.update_preferences(dietary=[arg])
        console.print(f"[cyan]✓ Added dietary constraint: {arg}[/cyan]")
        return True

    if verb == "/reset":
        orchestrator.reset_preferences()
        console.print("[dim]Preferences reset.[/dim]")
        return True

    if verb == "/clear":
        orchestrator.clear_history()
        console.print("[dim]History cleared.[/dim]")
        return True

    return False


def run_interactive(user_id: str, debug: bool):
    print_banner()

    # Validate config
    warnings = validate_settings()
    for w in warnings:
        console.print(f"[yellow]⚠  {w}[/yellow]")
    if warnings:
        console.print()

    with KitchenOrchestrator(user_id=user_id) as orchestrator:
        console.print(f"[dim]Session started: [bold]{user_id}[/bold][/dim]")

        while True:
            try:
                user_input = Prompt.ask("\n[bold yellow]You[/bold yellow]")
            except (EOFError, KeyboardInterrupt):
                console.print("\n[green]Good bye![/green]")
                break

            if not user_input.strip():
                continue

            # Exit
            if user_input.strip().lower() in ("exit", "quit"):
                console.print("\n[dim]Come back hungry! 🍋[/dim]")
                break

            # Commands
            if user_input.strip().startswith("/"):
                handle_command(user_input.strip(), orchestrator)
                continue

            # Run the agent pipeline
            console.print("\n[dim]🔄 Thinking...[/dim]")
            try:
                result = orchestrator.run(user_input, max_iterations=2)
                print_result(result, debug=debug)
            except Exception as e:
                console.print(f"[red]Error: {e}[/red]")
                if debug:
                    import traceback
                    traceback.print_exc()


def main():
    parser = argparse.ArgumentParser(description="Moroccan Kitchen AI — Terminal App")
    parser.add_argument("--user-id", default="USER", help="User identifier")
    parser.add_argument("--debug", action="store_true", help="Show verbose agent traces")
    args = parser.parse_args()

    run_interactive(user_id=args.user_id, debug=args.debug)


if __name__ == "__main__":
    main()
