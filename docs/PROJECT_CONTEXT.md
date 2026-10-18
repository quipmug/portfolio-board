# Project context

## Purpose and architecture

A minimalist English-language personal portfolio and notes board, published at https://quipmug.github.io/portfolio-board/. Visitors browse Projects, Notes and About; one owner manages entries, private drafts, contacts and the introduction through Supabase.

- Static HTML, CSS and vanilla browser JavaScript; no application framework or production server.
- index.html contains the stable application and owner-dialog hooks. styles.css defines the visual system.
- site.js owns data loading, routes, filters, authentication and owner operations. Its original metadata formatter has a small presentation wrapper to show the existing published date in all three sections; date format and Draft text are preserved.
- config.js holds the public Supabase URL and publishable key. RLS and the UUID owner check remain the security boundary; hidden controls never grant permissions.
- serve.mjs is a loopback preview server with an explicit public-file boundary. GitHub Actions checks the code and deploys the static allowlist on pushes to main.

## Current visual system

The October 18 revision uses a centered reading column of approximately 501px and a 12.75px desktop root size. Touch devices use a 13px root, 20px safe-area-aware gutters, identity text at least 12px and 16px interest icons. Continuous top padding avoids the old jump at tablet width. Compact introduction and footer spacing keeps the page short without reducing type further. Local Inter is the only shipped font. The interface remains neutral monochrome, with system/light/dark modes, secondary text at least 12px, compact desktop identity text around 11.5px, 44px touch controls and 16px mobile form fields. Fine-pointer contacts, tabs and infinity controls use 32px rows. Dates, counters and the Kyiv clock use tabular numerals.

The header contains a quipmug home/top link and theme control. The brand is around 16px, with a short greeting on hover, keyboard focus or activation. Maxim Kochergin sits below the brand, followed by Software Engineer and DevOps joined by an interactive infinity mark, then small crypto, AI, tech, trading and programming interests. Each interest is a native button with its own icon animation: coin flips, a sparkle pulse, an atom orbit, an ascending chart and opening code brackets. Buttons become interactive only after setup; they stay readable static text if JavaScript is unavailable. Touch buttons keep 44px hit areas; narrow phones use balanced interest rows so Programming is not isolated. Hover color applies only to fine pointers, preventing sticky touch highlights. The infinity icon uses an integer pixel size and a short two-dimensional turn that settles into the same hover or resting transform. Each animation run has its own completion identity; reduced motion stays immediate, and hiding the page clears temporary states. The existing editable introduction appears as prose above wrapping, underlined text links without icons, pills or animated fills. Projects / Notes / About remain horizontal at every breakpoint, with a six-pixel active dot below the label. Compact lists show titles and dates with subtle separators; entry bodies retain formatting and native history navigation. Owner dialogs remain scrollable bottom sheets on phones and short touch landscapes, with wider centered dialogs on larger tablets.

The footer contains only Kyiv time and the small Tabler ghost beside it, plus the existing owner access when applicable. The ghost sits approximately 5px from the clock while retaining its 44px hit area. There is no duplicate brand, signature, divider, full-width rail or Back to top control. The header brand remains the top shortcut. The introduction remains owner-controlled; no production content was overwritten. The Trading icon uses a small upward bounce and stays visible throughout its animation.

## Time and character

- assets/local-time.js exports pure browser/CommonJS helpers. TIME_ZONE, its legacy fallback and LOCATION_LABEL live here. Intl resolves Europe/Kyiv (fallback Europe/Kiev) with daylight-saving changes. Display uses a 12-hour clock, for example 3:25 PM in Kyiv, Ukraine; internal hours and datetime remain 24-hour values.
- assets/footer-init.js runs synchronously before CSS to select the initial ghost face and expose the direct manage route. Without JavaScript the clock stays hidden and the daytime face remains visible.
- assets/footer.js updates the clock, face and English ARIA label together at minute boundaries, pauses while hidden and resynchronizes on return, window focus, history navigation and ghost interaction. A transient time-render error schedules the next update; a greeting error cannot stop the clock. Press feedback starts immediately and clears on every release or cancellation. One short phase-specific greeting settles on actual animation completion; a safety timeout remains. Movement, scrolling, multitouch and an out-of-bounds release cancel the gesture. It has no idle animation timers.
- Ghost scenes follow Kyiv time: night 23:00–05:59, morning 06:00–10:59, day 11:00–17:59, evening 18:00–22:59. Four matching derivatives have a refined rounded contour: waking and yawning, alert and cheerful, relaxed, then sleeping. Greetings are a morning stretch, a daytime wave, an evening nod and a gentle nighttime breath.
- A strict 24-hour ?time=HH:MM query previews both the clock and face. It composes with ?manage=1 and hash routes. A preview datetime is a valid time of day; the real clock uses a full timestamp with its Kyiv offset.
- Reduced motion disables the greeting while preserving long-press access.

The original 581-byte Tabler ghost-2 SVG is retained unchanged. Four derived ghost-day, ghost-morning, ghost-evening and ghost-night assets render as local currentColor CSS masks at an integer 26px size. Their MIT license and pinned source are recorded in assets/THIRD_PARTY.txt. Only transforms and opacity animate, with theme color transitions as the existing exception.

## Owner access and data boundary

Owner sign-in is hidden from ordinary visitor display, accessibility and keyboard navigation by CSS. The original #owner-access element stays in the DOM. The ?manage=1 route and recognized owner state expose it. Holding the small ghost for 800ms invokes its existing click handler; it does not duplicate authentication logic or bypass access checks. README describes both entry paths.

Public reads, private drafts, all five dialogs and existing write/conflict guards remain intact. Production data/settings are not changed for visual work. Never ship a service-role or secret key. Sign-out ends only the current browser session. Owner writes use RLS, version comparisons and the existing save_external_links conflict check.

SDK/transport/UI waits are bounded. New-entry retries reuse a UUID after uncertain writes. Unsaved entry/contact/profile changes retain unload/discard guards. Regression tests cover failures, late replies, cooldowns, conflicts, deep links and focus restoration; interactive owner QA uses an isolated browser-memory fixture without production writes or email sends.

## Progressive enhancement and assets

assets/theme-init.js applies persisted preferences before paint. assets/theme.js rereads the latest stored preference when it starts, receives storage events or restores a page from the back-forward cache. This avoids stale themes when another tab changes the preference during loading or while the page is frozen. Live system mode and theme metadata stay synchronized. All storage access is guarded.

assets/mobile.js measures the visual viewport only for open responsive dialogs. It updates three CSS variables when the on-screen keyboard shrinks or pans the visible area, clears overrides during pinch zoom, closure or page hiding, and uses one scheduled frame per event batch. The viewport meta also opts into keyboard content resizing where supported. Dialog scroll padding keeps focused fields away from the edge. Without this enhancement the native dialog and dvh sizing remain available.

assets/ascii.js adds a small satellite outside the reading column only at desktop widths of at least 1100px with a fine hover pointer and no coarse pointer. Touch devices create no satellite nodes or artwork requests. The local Tabler satellite SVG is converted into three 28-column, 16-row ASCII layers in assets/art/satellite.json. One introductory signal and hover, focus or click signals use short CSS animations, without a continuous animation loop. Reduced motion keeps a static frame; leaving the viewport or page stops motion. Media changes abort pending artwork requests and remove the enhancement. The square uses the system monospace stack and does not alter the reading column or owner controls.

assets/navigation.js maintains horizontal keyboard tabs and a concise Back presentation. assets/motion.js measures the dot on selection, font/viewport changes and orientation changes while preserving View Transitions. assets/fx.js retains optional pointer code behind a single effects object: cursor, magnet and spotlight default false; reveal defaults true. Default pointer effects create no nodes/listeners; content and footer reveal remain guarded and fail open. Reveal triggers on first intersection so very long code blocks cannot remain concealed behind an unreachable percentage threshold. CSS masks preserve the system text color in Windows high contrast. The real cursor and reduced-motion behavior stay native.

Fonts, icons and the pinned Supabase bundle are local; assets/THIRD_PARTY.txt records their provenance. CSP permits only local scripts/styles/fonts/images, with the exact existing Supabase connect origin. No inline script/style blocks or style attributes are introduced. Only the inert favicon has a separately hashed embedded theme stylesheet in the preview response.

## Checks and limits

Run npm run check and npm test. Pure tests cover AM/PM at midnight and noon, daylight-saving transitions, strict overrides, the zone fallback, all scene boundaries and shared early initialization. Preview tests request the Inter asset and expect the visible project date.

Browser QA covers both themes, 320/360/390/430/768/1280/1920 and phone landscape, touch long press, owner flows and route restoration. Physical mobile Safari/Android hardware remains a separate manual check.

GitHub Pages provides HTTPS but cannot configure every response-level security header or cache policy. robots.txt lives at the project subpath. Server Auth quotas and operational setup remain documented in SETUP.md; browser cooldowns and hidden entry points do not replace server protections. Historical audits under docs/history describe earlier versions and are not current design instructions.
