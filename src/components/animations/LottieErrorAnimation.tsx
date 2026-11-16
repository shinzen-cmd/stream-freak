"use client";

import React, { useEffect, useRef } from "react";

interface LottieErrorAnimationProps {
  className?: string;
}

export default function LottieErrorAnimation({
  className = "w-40 h-40 sm:w-52 sm:h-52",
}: LottieErrorAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animInstance: any = null;
    let isMounted = true;

    // Dynamically load lottie-web only on client
    import("lottie-web").then((lottieModule) => {
      if (!isMounted || !containerRef.current) return;
      const lottie = lottieModule.default || lottieModule;
      animInstance = lottie.loadAnimation({
        container: containerRef.current,
        renderer: "svg",
        loop: true,
        autoplay: true,
        path: "/animations/error-animation.json",
      });
    }).catch((err) => {
      console.warn("Failed to load Lottie animation:", err);
    });

    return () => {
      isMounted = false;
      if (animInstance) {
        animInstance.destroy();
      }
    };
  }, []);

  return <div ref={containerRef} className={`flex items-center justify-center pointer-events-none select-none ${className}`} />;
}
