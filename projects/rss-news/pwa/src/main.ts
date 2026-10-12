import { HttpApiClient } from "./api/client";
import { renderShell } from "./screens/shell";

const root = document.getElementById("app");
if (!root) {
  throw new Error("index.html has no #app element to render into");
}
void renderShell(root, new HttpApiClient(document.baseURI));
