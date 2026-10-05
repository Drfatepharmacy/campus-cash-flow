// Browser-only QR renderer (canvas + SVG). Never touches the filesystem, so it is
// safe to be in the SSR import graph. Only call its functions from effects/handlers.
// @ts-expect-error — subpath has no bundled types; shape matches the main qrcode API.
import QRCodeBrowser from "qrcode/lib/browser";
import type * as QRCodeTypes from "qrcode";

const QRCode = QRCodeBrowser as {
  toDataURL: (text: string, opts?: QRCodeTypes.QRCodeToDataURLOptions) => Promise<string>;
  toString: (text: string, opts?: QRCodeTypes.QRCodeToStringOptions) => Promise<string>;
};

export default QRCode;
