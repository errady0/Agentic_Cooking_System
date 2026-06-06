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
  exit | quit     — quit the app
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

sys.path.insert(0, os.path.dirname(__file__))

from config import settings, validate as validate_settings
from orchestrator import KitchenOrchestrator, KitchenResult

console = Console()


# ── Panel helpers ──────────────────────────────────────────────────────────────

# Maps intent → (emoji, label, border colour)
_INTENT_STYLE: dict[str, tuple[str, str, str]] = {
    "culinary"              : ("🍽️",  "Recipe",          "green"),
    "non_moroccan_culinary" : ("🌍",  "World Kitchen",   "green"),
    "culinary_info"         : ("📖",  "Culinary Info",   "cyan"),
    "chitchat"              : ("💬",  "Chat",            "yellow"),
    "out_of_scope"          : ("🚫",  "Out of scope",    "red"),
}


def _panel_style(intent: str) -> tuple[str, str, str]:
    return _INTENT_STYLE.get(intent, ("🍋", "Assistant", "green"))


# ── Banner ────────────────────────────────────────────────────────────────────

def print_banner():
    console.print(
        "\n[bold green]🍋  Moroccan Kitchen AI[/bold green]\n"
        "[dim]— Type [bold]/help[/bold] for commands | [bold]exit[/bold] to quit[/dim]\n"
    )


# ── Result renderer ───────────────────────────────────────────────────────────

def print_result(result: KitchenResult, debug: bool = False):
    """Pretty-print a completed KitchenResult."""
    emoji, label, colour = _panel_style(result.intent)

    console.print()
    console.print(Panel(
        Markdown(result.final_response),
        title=f"[bold {colour}]{emoji}  {label}[/bold {colour}]",
        border_style=colour,
        padding=(1, 2),
    ))

    # Quality score + iteration count (only for full pipeline runs)
    if result.critic_score is not None:
        score_color = (
            "green"  if result.critic_score >= 7 else
            "yellow" if result.critic_score >= 5 else
            "red"
        )
        console.print(
            f"[dim]  Quality score: [{score_color}]{result.critic_score}/10"
            f"[/{score_color}]  |  Revisions: {result.iteration_count}[/dim]"
        )

    # Debug extras
    if debug:
        if result.recommended_recipes:
            console.print("[dim][Recommendation agent][/dim]")
            for r in result.recommended_recipes:
                console.print(
                    f"  • {r.get('name')} — {r.get('difficulty')} — {r.get('time_minutes')} min"
                )
        if result.style_choice:
            console.print(f"[dim][Style chosen] {result.style_choice}[/dim]")
        if result.session_summary:
            console.print(f"[dim][Session summary] {result.session_summary}[/dim]")
        console.print(f"[dim][Intent] {result.intent}[/dim]")


def print_clarification(result: KitchenResult):
    """Render the clarification question for non-Moroccan dishes."""
    console.print()
    console.print(Panel(
        Markdown(result.final_response),
        title="[bold yellow]🌍  World Kitchen — Choose your style[/bold yellow]",
        border_style="yellow",
        padding=(1, 2),
    ))


# ── Slash-command handler ─────────────────────────────────────────────────────

def handle_command(cmd: str, orchestrator: KitchenOrchestrator) -> bool:
    """Handle slash commands. Returns True if handled, False if unknown."""
    parts = cmd.strip().split(None, 1)
    verb  = parts[0].lower()
    arg   = parts[1] if len(parts) > 1 else ""

    if verb == "/help":
        console.print(Panel(__doc__, title="Help", border_style="blue"))
        return True

    if verb in ("/preferences", "/pr"):
        prefs = orchestrator.get_preferences()
        t = Table(title="Your stored preferences", box=box.SIMPLE)
        t.add_column("Category", style="bold")
        t.add_column("Values")
        t.add_row("Liked dishes",        ", ".join(prefs.get("liked",    [])) or "—")
        t.add_row("Disliked dishes",     ", ".join(prefs.get("disliked", [])) or "—")
        t.add_row("Dietary constraints", ", ".join(prefs.get("dietary",  [])) or "—")
        t.add_row("Flavor notes",        prefs.get("flavor_notes", "") or "—")
        console.print(t)
        return True

    if verb == "/history":
        history = orchestrator.get_history()
        console.print(Panel(
            history or "No history yet.",
            title="Session history",
            border_style="dim",
        ))
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

    console.print(f"[red]Unknown command:[/red] {verb}  — type [bold]/help[/bold] for the list")
    return False


# ── Clarification loop (non-Moroccan dish) ────────────────────────────────────

def handle_clarification_loop(
    result: KitchenResult,
    orchestrator: KitchenOrchestrator,
    debug: bool,
):
    """
    When the graph is waiting for the user's style choice, display the
    clarification question and re-invoke with their answer.
    Retries once on empty input.
    """
    print_clarification(result)

    for attempt in range(2):
        try:
            choice = Prompt.ask("\n[bold yellow]Your choice[/bold yellow]").strip()
        except (EOFError, KeyboardInterrupt):
            console.print("\n[dim]Cancelled — returning to main loop.[/dim]")
            return

        if not choice:
            if attempt == 0:
                console.print("[dim]Please type your choice (e.g. 'classic' or 'moroccan twist').[/dim]")
                continue
            # Second empty — default to classic silently
            choice = "classic"
            console.print("[dim]No choice given — going with the classic version.[/dim]")

        console.print("\n[dim]🔄 Preparing your recipe...[/dim]")
        try:
            final_result = orchestrator.answer_style_choice(choice)
            print_result(final_result, debug=debug)
        except Exception as e:
            console.print(f"[red]Error while preparing recipe: {e}[/red]")
            if debug:
                import traceback
                traceback.print_exc()
        return


# ── Main interactive loop ─────────────────────────────────────────────────────

def run_interactive(user_id: str, debug: bool):
    print_banner()

    # Config warnings
    warnings = validate_settings()
    for w in warnings:
        console.print(f"[yellow]⚠  {w}[/yellow]")
    if warnings:
        console.print()

    with KitchenOrchestrator(user_id=user_id) as orchestrator:
        # Personalised welcome using stored username (falls back to user_id)
        profile  = orchestrator.get_user_profile()
        username = profile.get("username") or user_id
        console.print(
            f"[dim]Welcome back, [bold]{username}[/bold]! "
            f"Session ID: [italic]{orchestrator.thread_id[:8]}…[/italic][/dim]"
        )

        while True:
            try:
                user_input = Prompt.ask("\n[bold yellow]You[/bold yellow]")
            except (EOFError, KeyboardInterrupt):
                console.print("\n[green]Good bye![/green]")
                break

            if not user_input.strip():
                continue

            if user_input.strip().lower() in ("exit", "quit"):
                console.print("\n[dim]Come back hungry! 🍋[/dim]")
                break

            if user_input.strip().startswith("/"):
                handle_command(user_input.strip(), orchestrator)
                continue

            # ── Normal pipeline run ───────────────────────────────────────────
            console.print("\n[dim]🔄 Thinking...[/dim]")
            try:
                result = orchestrator.run(user_input, max_iterations=3)

                if result.waiting:
                    # Non-Moroccan dish: graph paused, needs style choice
                    handle_clarification_loop(result, orchestrator, debug=debug)
                else:
                    print_result(result, debug=debug)

            except Exception as e:
                console.print(f"[red]Error: {e}[/red]")
                if debug:
                    import traceback
                    traceback.print_exc()


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Moroccan Kitchen AI — Terminal App")
    parser.add_argument("--user-id", default="Guest", help="User identifier")
    parser.add_argument("--debug",   action="store_true", help="Show verbose agent traces")
    args = parser.parse_args()

    run_interactive(user_id=args.user_id, debug=args.debug)


if __name__ == "__main__":
    main()