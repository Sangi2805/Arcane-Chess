import { ArcaneBoard3D } from "./ArcaneBoard3D.js";

const isWebGLAvailable = () => {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl2") ||
          canvas.getContext("webgl") ||
          canvas.getContext("experimental-webgl"))
    );
  } catch (error) {
    return false;
  }
};

window.Arcane3D = {
  available: isWebGLAvailable(),
  createBoard3D(options) {
    if (!this.available) {
      throw new Error("WebGL is unavailable on this device.");
    }

    return new ArcaneBoard3D(options);
  }
};

window.dispatchEvent(new Event("arcane-3d-ready"));
