import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeProps {
  /** The text encoded into the code — usually a passport share URL. */
  value: string;
  /** Rendered pixel size. Labels print at 512px, previews can be smaller. */
  size?: number;
  className?: string;
  /** Invert for dark-on-light label printing. Defaults to dark modules on white. */
  invert?: boolean;
}

/**
 * Renders a QR code entirely on-device (no network, no image service), which is what
 * makes printed field labels possible with no connection at all.
 */
export const QrCode: React.FC<QrCodeProps> = ({ value, size = 512, className, invert = false }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'L',
      color: invert ? { dark: '#ffffff', light: '#05070a' } : { dark: '#05070a', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) {
          setSrc(url);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size, invert]);

  if (error) {
    return (
      <div className="flex h-40 w-40 items-center justify-center rounded border border-rose-800 bg-rose-950/40 p-3 text-center text-[11px] text-rose-300">
        Label could not be encoded: {error}
      </div>
    );
  }

  if (!src) {
    return <div className="h-40 w-40 animate-pulse rounded bg-slate-800" aria-label="Generating QR label" />;
  }

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt="Timber passport QR label"
      data-testid="passport-qr"
      className={className ?? 'rounded bg-white'}
    />
  );
};
