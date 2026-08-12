# Angular

`@feedbackhub/angular` (`packages/angular`) wraps the vanilla SDK as an injectable service,
registered via a `forRoot()` module, mirroring [react.md](react.md)'s provider/hook shape. See
[sdk.md](sdk.md) for what each underlying method does.

## Setup

```ts
import { NgModule } from "@angular/core";
import { FeedbackHubModule } from "@feedbackhub/angular";

@NgModule({
  imports: [
    FeedbackHubModule.forRoot({
      projectKey: "pk_...",
      sdkUrl: "https://your-api.example.com/sdk.js",
      apiBaseUrl: "https://your-api.example.com", // optional
      debug: false, // optional
    }),
  ],
})
export class AppModule {}
```

`FeedbackHubService` is instantiated once (root-provided) and loads the `<script>` tag in its
constructor — deduplicated via a `data-feedbackhub-sdk` attribute, so it's safe even if something
else on the page also loads the SDK. Once the script loads, it calls
`init({ projectKey, apiBaseUrl, debug })` automatically.

## Usage

```ts
import { Component } from "@angular/core";
import { FeedbackHubService } from "@feedbackhub/angular";

@Component({
  selector: "app-feedback-button",
  template: `<button (click)="openSurvey()">Give feedback</button>`,
})
export class FeedbackButtonComponent {
  constructor(private feedback: FeedbackHubService) {}

  openSurvey() {
    this.feedback.open("NPS Survey");
  }
}
```

Every method proxies to `window.FeedbackHub`, so it's safe to call before the underlying script has
finished loading — calls just silently no-op until then.

Available methods: `init`, `open`, `close`, `show`, `hide`, `identify`, `track`, `destroy`.

## Build note

`packages/angular` is compiled with plain `tsc` (decorators + decorator metadata enabled), not
`ng-packagr`. This works fine when consumed directly inside an Angular CLI app's JIT/dev build, but
if this package is ever published to npm as a standalone library, it should be rebuilt with
`ng-packagr` to produce proper Ivy metadata — tracked in [TODO.md](../TODO.md).
