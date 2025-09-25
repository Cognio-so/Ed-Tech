"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';

// Simple GLB Viewer Component
const GLBViewer = ({ lipSyncData, isSpeaking, isConnected }) => {
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const modelRef = useRef(null);
  const headMeshRef = useRef(null);
  
  // Refs to pass props to the animation loop without causing re-renders
  const isSpeakingRef = useRef(isSpeaking);
  const lipSyncDataRef = useRef(lipSyncData);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState('Starting...');

  // Update refs when props change
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    lipSyncDataRef.current = lipSyncData;
  }, [lipSyncData]);


  useEffect(() => {
    if (!mountRef.current) return;
    // Prevent re-initialization
    if (rendererRef.current) return;

    let animationFrameId;

    const init = async () => {
      try {
        setDebugInfo('Loading Three.js...');
        const THREE = await import('three');
        setDebugInfo('Three.js loaded');

        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        setDebugInfo('GLTFLoader loaded');

        // Scene, Camera, Renderer setup
        const scene = new THREE.Scene();
        sceneRef.current = scene;
        scene.background = null;

        const camera = new THREE.PerspectiveCamera(35, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
        camera.position.set(0, 0, 2.8);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ 
          antialias: true, 
          alpha: true,
          powerPreference: "high-performance"
        });
        renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
        renderer.setClearColor(0x000000, 0);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        renderer.setPixelRatio(window.devicePixelRatio);
        mountRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;
        
        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
        directionalLight.position.set(5, 10, 5);
        directionalLight.castShadow = true;
        scene.add(directionalLight);
        const fillLight = new THREE.DirectionalLight(0x8bb8ff, 0.8);
        fillLight.position.set(-5, 0, 5);
        scene.add(fillLight);
        
        // Load model
        const loader = new GLTFLoader();
        loader.load(
          '/female_char.glb',
          (gltf) => {
            setDebugInfo('Model loaded successfully!');
            const model = gltf.scene;
            modelRef.current = model;
            model.scale.set(1.6, 1.6, 1.6);
            model.position.set(0, -2.3, 0);

            // Find head mesh and enable morph targets
            model.traverse((child) => {
              if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.material) {
                  child.material.morphTargets = true; // Essential for lip-sync
                  child.material.roughness = 0.6;
                  child.material.metalness = 0.1;
                }
                if (!headMeshRef.current && (child.name.toLowerCase().includes('head') || child.name.toLowerCase().includes('face'))) {
                  headMeshRef.current = child;
                }
              }
            });
            
            scene.add(model);
            setIsLoading(false);
            setDebugInfo('Model loaded and ready!');
          },
          (progress) => setDebugInfo(`Loading: ${Math.round(progress.loaded / progress.total * 100)}%`),
          (error) => {
            setError(`Failed to load 3D model: ${error.message}`);
            setIsLoading(false);
          }
        );

        const clock = new THREE.Clock();
        
        const animate = () => {
          animationFrameId = requestAnimationFrame(animate);
          
          const elapsedTime = clock.getElapsedTime();
          const model = modelRef.current;
          const headMesh = headMeshRef.current;

          if (model) {
            // Subtle head movement when speaking
            if (isSpeakingRef.current) {
              const headBob = Math.sin(elapsedTime * 3) * 0.01;
              model.position.y = -2.3 + headBob;
            } else {
              model.position.y = -2.3;
            }
            model.rotation.y = Math.sin(elapsedTime * 0.1) * 0.05;
          }
          
          // *** THE CORE LIP-SYNC LOGIC FIX ***
          if (headMesh?.morphTargetInfluences && headMesh?.morphTargetDictionary) {
            const influences = headMesh.morphTargetInfluences;
            const dictionary = headMesh.morphTargetDictionary;
            const data = lipSyncDataRef.current;

            // Smoothly reset all morph targets to 0
            for (let i = 0; i < influences.length; i++) {
                influences[i] += (0 - influences[i]) * 0.3;
            }

            // Apply new values based on data, makes it more robust
            if (data && isSpeakingRef.current) {
                if (dictionary['viseme_aa'] !== undefined) influences[dictionary['viseme_aa']] = data.A;
                else if (dictionary['mouthOpen'] !== undefined) influences[dictionary['mouthOpen']] = Math.max(influences[dictionary['mouthOpen']] || 0, data.A);

                if (dictionary['viseme_E'] !== undefined) influences[dictionary['viseme_E']] = data.E;
                else if (dictionary['mouthSmile'] !== undefined) influences[dictionary['mouthSmile']] = Math.max(influences[dictionary['mouthSmile']] || 0, data.E);
                
                if (dictionary['viseme_I'] !== undefined) influences[dictionary['viseme_I']] = data.I;
                else if (dictionary['mouthSmile'] !== undefined) influences[dictionary['mouthSmile']] = Math.max(influences[dictionary['mouthSmile']] || 0, data.I);

                if (dictionary['viseme_O'] !== undefined) influences[dictionary['viseme_O']] = data.O;
                else if (dictionary['mouth_O'] !== undefined) influences[dictionary['mouth_O']] = data.O;
                else if (dictionary['mouthOpen'] !== undefined) influences[dictionary['mouthOpen']] = Math.max(influences[dictionary['mouthOpen']] || 0, data.O);

                if (dictionary['viseme_U'] !== undefined) influences[dictionary['viseme_U']] = data.U;
                else if (dictionary['mouth_U'] !== undefined) influences[dictionary['mouth_U']] = data.U;
                else if (dictionary['mouthOpen'] !== undefined) influences[dictionary['mouthOpen']] = Math.max(influences[dictionary['mouthOpen']] || 0, data.U);
            }
          }
          
          if (renderer && scene && camera) {
              renderer.render(scene, camera);
          }
        };
        
        animate();

      } catch (err) {
        setError(`Failed to initialize: ${err.message}`);
        setIsLoading(false);
      }
    };

    init();

    // Cleanup function
    return () => {
      cancelAnimationFrame(animationFrameId);
      if (rendererRef.current && mountRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []); // <-- This dependency array is intentionally empty to run setup only once.

  return (
    <div className="w-full h-full relative overflow-hidden">
      <div 
        ref={mountRef} 
        className="w-full h-full"
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-sm text-white">Loading 3D Model...</p>
            <p className="text-xs text-purple-400 mt-2">{debugInfo}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Main 3D Lip Sync Component (No changes needed here)
const LipSyncTeacher3D = ({ 
    lipSyncData = { A: 0, E: 0, I: 0, O: 0, U: 0 }, 
    isConnected = false,
    isSpeaking = false 
}) => {
    return (
        <div className="w-full h-[570px] relative overflow-hidden">
            <GLBViewer 
                lipSyncData={lipSyncData}
                isConnected={isConnected}
                isSpeaking={isSpeaking}
            />
        </div>
    );
};

export default LipSyncTeacher3D;