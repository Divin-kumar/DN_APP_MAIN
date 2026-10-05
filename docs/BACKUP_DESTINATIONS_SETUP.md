# Optional Google Drive backup setup

Google Drive is an optional, user-initiated file destination. It is not DN sign-in, the Device Principal, profile sync, or background synchronization. Device and Files/iCloud paths remain usable without Google configuration.

Configure these public Vite variables in the deployment environment (never put a client secret or refresh token in a Vite variable):

- `VITE_GOOGLE_OAUTH_CLIENT_ID`: OAuth 2.0 Web application client ID.
- `VITE_GOOGLE_API_KEY`: API key restricted to the production HTTPS origins and Google Picker API.
- `VITE_GOOGLE_APP_ID`: Google Cloud project number used by Picker.

In Google Cloud Console, enable Google Drive API and Google Picker API, configure the OAuth consent screen and authorized JavaScript origins, and use the least-privilege `drive.file` OAuth scope. Test consent denial, popup blocking, revoked/expired tokens, file selection cancellation, and interrupted transfers before enabling this deployment-wide.

Tokens are requested only after the user selects Google Drive and are held in memory for the request. The implementation does not use Firebase Auth or persist Google tokens. Drive selection is limited to files the user selects through Picker, and imports are passed to DN's existing local validation and restore preview.

## iPhone / Safari / PWA

DN cannot directly write to iCloud Drive from a web page. On browsers that support file sharing, the Save to iCloud Drive action opens the native share sheet; the user must choose **Save to Files** and a location. Elsewhere, DN downloads the backup and explains that it must be moved to iCloud Drive in Files. Import uses the browser/system file picker, where the user can browse iCloud Drive. Neither flow confirms ongoing availability or synchronizes changes.

Google Drive transfers require network connectivity. They do not queue or run in the background while offline.
