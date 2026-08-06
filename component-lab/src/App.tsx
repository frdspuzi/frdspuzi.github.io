import { ShaderBackground } from "@/components/motion/shader-background";

function App() {
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <ShaderBackground
        variant="mesh-gradient"
        className="absolute inset-0"
        colors={["#00ffb2", "#0072ff", "#a200ff", "#001a2c"]}
        distortion={0.6}
        swirl={0.5}
        speed={0.3}
      />
    </div>
  );
}

export default App;
