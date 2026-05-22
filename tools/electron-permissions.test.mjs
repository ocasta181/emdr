import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allowsAudioMediaPermission } from "../dist-electron/src/main/internal/lib/electron/permissions.js";

describe("Electron permission policy", () => {
  it("allows main-frame audio media for packaged renderer files", () => {
    assert.equal(
      allowsAudioMediaPermission(
        {
          isMainFrame: true,
          mediaTypes: ["audio"],
          requestingUrl: "file:///Applications/EMDR%20Local.app/Contents/Resources/app/dist/index.html"
        },
        {}
      ),
      true
    );
  });

  it("allows main-frame audio media for the configured dev server", () => {
    assert.equal(
      allowsAudioMediaPermission(
        {
          isMainFrame: true,
          mediaTypes: ["audio"],
          requestingOrigin: "http://127.0.0.1:5173"
        },
        { devServerUrl: "http://127.0.0.1:5173" }
      ),
      true
    );
  });

  it("rejects video, subframes, and foreign origins", () => {
    const options = { devServerUrl: "http://127.0.0.1:5173" };

    assert.equal(
      allowsAudioMediaPermission(
        {
          isMainFrame: true,
          mediaTypes: ["video"],
          requestingOrigin: "http://127.0.0.1:5173"
        },
        options
      ),
      false
    );
    assert.equal(
      allowsAudioMediaPermission(
        {
          isMainFrame: false,
          mediaTypes: ["audio"],
          requestingOrigin: "http://127.0.0.1:5173"
        },
        options
      ),
      false
    );
    assert.equal(
      allowsAudioMediaPermission(
        {
          isMainFrame: true,
          mediaTypes: ["audio"],
          requestingOrigin: "https://example.com"
        },
        options
      ),
      false
    );
  });
});
