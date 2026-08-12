import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import Home from "@/pages/Home";

// Lazy, not eager like Home: Post pulls in `marked` (markdown parsing) purely for the one
// unpublished placeholder post - dead weight in the main bundle for every visitor who never
// leaves the homepage. Flagged by Lighthouse as unused JS on the homepage specifically.
const Post = lazy(() => import("@/pages/Post"));

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/:year/:month/:day/:title/"
          element={
            <Suspense fallback={null}>
              <Post />
            </Suspense>
          }
        />
      </Routes>
    </Layout>
  );
}

export default App;
