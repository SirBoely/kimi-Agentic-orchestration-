Discover and run actions on the 9,000+ apps connected through Zapier.

Three modes, selected via `mode`:
- `list_actions` — list the actions available on an app (pass `appKey`, e.g. `"SlackCLIAPI"`; optionally filter by `actionType`).
- `get_input_schema` — inspect the input fields a specific action expects, before calling it (pass `appKey`, `actionType`, `actionKey`).
- `run_action` — execute an action (pass `appKey`, `actionType`, `actionKey`, and `inputs` keyed by the field keys from `get_input_schema`).

Always call `list_actions` to find the right `appKey`/`actionKey` before running one, and `get_input_schema` before passing `inputs` you haven't verified. `authenticationId` can usually be omitted when the app has only one connected account.

If a call fails with an authentication error, tell the user to run `npx zapier-sdk login` to connect their Zapier account, then retry.
