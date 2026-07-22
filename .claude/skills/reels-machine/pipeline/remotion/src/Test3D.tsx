import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";

export const Test3D: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      <ThreeCanvas width={1080} height={1920} style={{ background: "transparent" }}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[5, 8, 6]} intensity={2.5} />
        <pointLight position={[-4, -2, 4]} intensity={2} color="#9AFF00" />
        <mesh rotation={[f * 0.04, f * 0.05, 0]} scale={2.4}>
          <torusKnotGeometry args={[1, 0.32, 160, 40]} />
          <meshStandardMaterial color="#9AFF00" metalness={0.85} roughness={0.12} />
        </mesh>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
