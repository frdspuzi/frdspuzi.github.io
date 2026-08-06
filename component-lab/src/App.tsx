import { Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import Home from "@/pages/Home";
import Post from "@/pages/Post";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/:year/:month/:day/:title/" element={<Post />} />
      </Routes>
    </Layout>
  );
}

export default App;
