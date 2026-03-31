'use client';

import { motion } from 'framer-motion';

export default function Printer({
  children,
  isPrinting,
  showPaper,
}: {
  children: React.ReactNode;
  isPrinting: boolean;
  showPaper: boolean;
}) {
  return (
    <div className="printer-shell">
      <motion.div
        className="printer-body"
        animate={
          isPrinting
            ? { x: [0, -2, 2, -1, 1, 0], rotate: [0, -0.5, 0.5, -0.4, 0.25, 0] }
            : { x: 0, rotate: 0 }
        }
        transition={{
          duration: isPrinting ? 0.4 : 0.25,
          repeat: isPrinting ? Infinity : 0,
          ease: 'easeInOut',
        }}
      >
        <span className="printer-bow left" aria-hidden="true" />
        <span className="printer-bow right" aria-hidden="true" />
        <span className="printer-feet left" aria-hidden="true" />
        <span className="printer-feet right" aria-hidden="true" />

        <div className="printer-ears" aria-hidden="true">
          <span className="printer-ear left" />
          <span className="printer-ear right" />
        </div>

        <div className="printer-side-controls left" aria-hidden="true">
          <span className="side-button large" />
          <span className="side-button small" />
        </div>

        <div className="printer-side-controls right" aria-hidden="true">
          <span className="side-button vent" />
          <span className="side-button indicator" />
        </div>

        <div className="printer-top">
          <div className="printer-top-spacer" aria-hidden="true" />
          {isPrinting ? (
            <div className="printer-status">
              <span className="printer-dot live" />
              printing
            </div>
          ) : null}
        </div>

        <div className="printer-face">
          <div className="screen-bar">
            <span className="screen-camera" />
            <span className="screen-status">wifi 100%</span>
          </div>

          <div className="paper-slot" aria-hidden="true">
            {showPaper ? (
              <motion.div
                initial={{ y: -26, opacity: 0 }}
                animate={isPrinting ? { y: [0, 8, 18, 10], opacity: 1 } : { y: 10, opacity: 1 }}
                transition={{
                  repeat: isPrinting ? Infinity : 0,
                  duration: isPrinting ? 1.2 : 0.9,
                  ease: 'easeInOut',
                }}
                className="slot-paper"
              />
            ) : null}
          </div>

          <div className="receipt-window">{children}</div>
        </div>
      </motion.div>
    </div>
  );
}
