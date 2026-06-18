"use client";

interface LoaderSparkleProps {
  className?: string;
}

export function LoaderSparkle({ className }: LoaderSparkleProps) {

  return (
    <div className={className}>
      <div className="main">
        <div className="up">
          <div className="loaders">
            {[...Array(10)].map((_, index) => (
              <div key={`loader-${index}`} className="loader" />
            ))}
          </div>
          <div className="loadersB">
            {[...Array(9)].map((_, index) => (
              <div key={`loaderA-${index}`} className="loaderA">
                <div className={`ball${index}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <style jsx>{`
        .main {
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          width: 2rem;
          height: 2rem;
          font-size: 0.5rem;
        }

        .loaders,
        .loadersB {
          display: flex;
          align-items: center;
          justify-content: center;
          position: absolute;
          inset: 0;
        }

        .loader {
          position: absolute;
          width: 0.7em;
          height: 6em;
          border-radius: 50px;
          background: #e0e0e0;
        }

        .loader:after {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          width: 0.7em;
          height: 2.2em;
          background: #e0e0e0;
          border-radius: 50px;
          border: 0.5px solid #e2e2e2;
          box-shadow:
            inset 2px 2px 6px #d3d2d2ab,
            inset -2px -2px 6px #e9e9e9ab;
          mask-image: linear-gradient(
            to bottom,
            black calc(100% - 24px),
            transparent 100%
          );
        }

        .loader::before {
          content: "";
          position: absolute;
          bottom: 0;
          right: 0;
          width: 0.7em;
          height: 2em;
          background: #e0e0e0;
          border-radius: 50px;
          border: 0.5px solid #e2e2e2;
          box-shadow:
            inset 2px 2px 6px #d3d2d2ab,
            inset -2px -2px 6px #e9e9e9ab;
          mask-image: linear-gradient(
            to top,
            black calc(100% - 24px),
            transparent 100%
          );
        }

        .loaderA {
          position: absolute;
          width: 0.7em;
          height: 6em;
          border-radius: 50px;
          background: transparent;
        }

        .ball0,
        .ball1,
        .ball2,
        .ball3,
        .ball4,
        .ball5,
        .ball6,
        .ball7,
        .ball8 {
          width: 0.7em;
          height: 0.7em;
          box-shadow:
            rgba(0, 0, 0, 0.17) 0px -6px 6px 0px inset,
            rgba(0, 0, 0, 0.15) 0px -8px 8px 0px inset,
            rgba(0, 0, 0, 0.1) 0px -20px 10px 0px inset,
            rgba(0, 0, 0, 0.06) 0px 1px 0.5px,
            rgba(0, 0, 0, 0.09) 0px 2px 1px,
            rgba(0, 0, 0, 0.09) 0px 4px 2px,
            rgba(0, 0, 0, 0.09) 0px 8px 3px,
            rgba(0, 0, 0, 0.09) 0px 16px 6px,
            0px -1px 6px -4px rgba(0, 0, 0, 0.09);
          border-radius: 50%;
          transition: transform 800ms cubic-bezier(1, -0.4, 0, 1.4);
          background-color: rgb(232, 232, 232, 1);
          animation: 3.63s move ease-in-out infinite;
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
        }

        .loader:nth-child(2) { transform: rotate(20deg); }
        .loader:nth-child(3) { transform: rotate(40deg); }
        .loader:nth-child(4) { transform: rotate(60deg); }
        .loader:nth-child(5) { transform: rotate(80deg); }
        .loader:nth-child(6) { transform: rotate(100deg); }
        .loader:nth-child(7) { transform: rotate(120deg); }
        .loader:nth-child(8) { transform: rotate(140deg); }
        .loader:nth-child(9) { transform: rotate(160deg); }

        .loaderA:nth-child(2) { transform: rotate(20deg); }
        .loaderA:nth-child(3) { transform: rotate(40deg); }
        .loaderA:nth-child(4) { transform: rotate(60deg); }
        .loaderA:nth-child(5) { transform: rotate(80deg); }
        .loaderA:nth-child(6) { transform: rotate(100deg); }
        .loaderA:nth-child(7) { transform: rotate(120deg); }
        .loaderA:nth-child(8) { transform: rotate(140deg); }
        .loaderA:nth-child(9) { transform: rotate(160deg); }

        .ball1 { animation-delay: 0.16s; }
        .ball2 { animation-delay: 0.32s; }
        .ball3 { animation-delay: 0.48s; }
        .ball4 { animation-delay: 0.64s; }
        .ball5 { animation-delay: 0.8s; }
        .ball6 { animation-delay: 0.96s; }
        .ball7 { animation-delay: 1.12s; }
        .ball8 { animation-delay: 1.28s; }

        @keyframes move {
          0% { transform: translateY(0em); }
          50% { transform: translateY(5.5em); }
          100% { transform: translateY(0em); }
        }
      `}</style>
    </div>
  );
}
