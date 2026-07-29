# Design

The production reference registry changes from three bundles to two: event operations and commerce operations. The organization module, exports, registrations and business-specific tests/e2e expectations are removed. Generic request/timeline/response UI tests remain and the default `createApp()` injection contract stays empty.

Historical Codument records remain immutable evidence; residue checks distinguish archived history and explicit negative guards from live production ownership.
