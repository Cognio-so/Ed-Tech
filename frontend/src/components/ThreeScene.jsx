"use client";

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';

// 3D Model Component with Lip Sync
function FemaleCharacter({ lipSyncData, isSpeaking, isConnected }) {
  const meshRef = useRef();
  const [currentMouthShape, setCurrentMouthShape] = useState('neutral');
  const [isBlinking, setIsBlinking] = useState(false);

  // Load the GLB model - using the specific model you want
  const gltf = useGLTF('/686bb46fa70935d615427a7a.glb');
  const scene = gltf?.scene;
  const animations = gltf?.animations;

  // Animations hook
  const { actions, mixer } = useAnimations(animations || [], scene || null);

  // Debug: Log lip sync data changes
  useEffect(() => {
    console.log('🎭 LipSync Data:', lipSyncData);
    console.log(' Is Speaking:', isSpeaking);
    console.log(' Is Connected:', isConnected);
    if (scene) {
      console.log('🎭 Model loaded successfully: 686bb46fa70935d615427a7a.glb');
    }
  }, [lipSyncData, isSpeaking, isConnected, scene]);

  // Determine mouth shape based on lip sync data
  useEffect(() => {
    if (!isSpeaking || !isConnected) {
      setCurrentMouthShape('neutral');
      return;
    }

    if (!lipSyncData) return;

    const { A = 0, E = 0, I = 0, O = 0, U = 0 } = lipSyncData;
    const maxValue = Math.max(A, E, I, O, U);
    
    if (maxValue > 0.1) {
      if (A === maxValue) setCurrentMouthShape('A');
      else if (E === maxValue) setCurrentMouthShape('E');
      else if (I === maxValue) setCurrentMouthShape('I');
      else if (O === maxValue) setCurrentMouthShape('O');
      else if (U === maxValue) setCurrentMouthShape('U');
    } else {
      setCurrentMouthShape('neutral');
    }
  }, [lipSyncData, isSpeaking, isConnected]);

  // Eye blinking animation
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      if (!isBlinking) {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 150);
      }
    }, 3000 + Math.random() * 2000);

    return () => clearInterval(blinkInterval);
  }, [isBlinking]);

  // Animation frame updates
  useFrame((state, delta) => {
    if (meshRef.current && scene) {
      // Gentle breathing animation
      const breathingScale = 1 + Math.sin(state.clock.elapsedTime * 0.5) * 0.02;
      meshRef.current.scale.setScalar(breathingScale);

      // Subtle head movement when speaking
      if (isSpeaking) {
        const headBob = Math.sin(state.clock.elapsedTime * 3) * 0.01;
        meshRef.current.position.y = headBob;
      } else {
        meshRef.current.position.y = 0;
      }

      // Apply lip sync to the 3D model
      meshRef.current.traverse((child) => {
        if (child.isMesh) {
          // Look for mouth-related geometry
          if (child.name && (
            child.name.toLowerCase().includes('mouth') ||
            child.name.toLowerCase().includes('lip') ||
            child.name.toLowerCase().includes('jaw') ||
            child.name.toLowerCase().includes('teeth')
          )) {
            // Apply mouth shape based on currentMouthShape
            switch (currentMouthShape) {
              case 'A':
                child.scale.y = 1.2;
                child.scale.x = 0.8;
                break;
              case 'E':
                child.scale.y = 0.6;
                child.scale.x = 1.1;
                break;
              case 'I':
                child.scale.y = 0.4;
                child.scale.x = 1.2;
                break;
              case 'O':
                child.scale.y = 1.1;
                child.scale.x = 0.9;
                break;
              case 'U':
                child.scale.y = 0.8;
                child.scale.x = 0.7;
                break;
              default:
                child.scale.y = 1;
                child.scale.x = 1;
            }
          }

          // Eye blinking
          if (child.name && (
            child.name.toLowerCase().includes('eye') ||
            child.name.toLowerCase().includes('eyelid')
          )) {
            if (isBlinking) {
              child.scale.y = 0.1;
            } else {
              child.scale.y = 1;
            }
          }
        }
      });
    }
  });

  // Play idle animation
  useEffect(() => {
    if (actions && Object.keys(actions).length > 0) {
      // Find and play idle animation
      const idleAction = actions['idle'] || actions['Idle'] || actions['T-Pose'] || Object.values(actions)[0];
      if (idleAction) {
        idleAction.reset().fadeIn(0.5).play();
      }
    }
  }, [actions]);

  // If model failed to load, show fallback
  if (!scene) {
    return <BasicFallback />;
  }

  return (
    <primitive 
      ref={meshRef} 
      object={scene.clone()} 
      scale={[1, 1, 1]} 
      position={[0, -0.5, 0]}
      rotation={[0, 0, 0]}
    />
  );
}

// Basic fallback component
function BasicFallback() {
  return (
    <group position={[0, -0.5, 0]}>
      <mesh>
        <boxGeometry args={[1, 1.3, 0.8]} />
        <meshStandardMaterial color="#ffdbac" />
      </mesh>
      <mesh position={[-0.2, 0.2, 0.41]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[0.2, 0.2, 0.41]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[0, -0.1, 0.41]}>
        <boxGeometry args={[0.15, 0.08, 0.02]} />
        <meshStandardMaterial color="#b83c3c" />
      </mesh>
    </group>
  );
}

// Loading fallback component
function ModelLoader() {
  return (
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="purple" wireframe />
    </mesh>
  );
}

// Three.js Scene Component
const ThreeScene = ({ lipSyncData, isConnected, isSpeaking, onError }) => {
  const [canvasError, setCanvasError] = useState(null);

  useEffect(() => {
    // Preload the GLB model
    try {
      useGLTF.preload('/686bb46fa70935d615427a7a.glb');
    } catch (error) {
      console.error('Failed to preload GLB model:', error);
    }
  }, []);

  if (canvasError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-2xl">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">3D Canvas Error</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{canvasError}</p>
        </div>
      </div>
    );
  }

  return (
    <Canvas
      camera={{ 
        position: [0, 0, 3], 
        fov: 50,
        near: 0.1,
        far: 1000
      }}
      style={{ 
        width: '100%', 
        height: '100%',
        borderRadius: '1rem'
      }}
      onError={(error) => {
        console.error('3D Canvas Error:', error);
        setCanvasError('Failed to initialize 3D canvas');
        if (onError) onError('Failed to initialize 3D canvas');
      }}
      gl={{ antialias: true, alpha: true }}
    >
      {/* Lighting Setup */}
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[10, 10, 5]} 
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[-10, -10, -5]} intensity={0.5} />
      <spotLight
        position={[0, 10, 0]}
        angle={0.15}
        penumbra={1}
        intensity={0.5}
        castShadow
      />

      {/* 3D Character with Suspense boundary */}
      <Suspense fallback={<ModelLoader />}>
        <FemaleCharacter 
          lipSyncData={lipSyncData}
          isSpeaking={isSpeaking}
          isConnected={isConnected}
        />
      </Suspense>

      {/* Environment */}
      <fog attach="fog" args={['#f0f0f0', 5, 50]} />
    </Canvas>
  );
};

export default ThreeScene;
