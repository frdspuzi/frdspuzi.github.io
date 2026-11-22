import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import Home from "@/pages/Home";

// Lazy, not eager like Home: Post pulls in `marked` (markdown parsing) purely for the one
// unpublished placeholder post - dead weight in the main bundle for every visitor who never
// leaves the homepage. Flagged by Lighthouse as unused JS on the homepage specifically.
const Post = lazy(() => import("@/pages/Post"));
// Lazy for the same reason (marked), and nested under Home so the reader overlays the homepage.
const BookReader = lazy(() => import("@/pages/BookReader"));

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />}>
          <Route
            path="books/:slug/"
            element={
              <Suspense fallback={null}>
                <BookReader />
              </Suspense>
            }
          />
        </Route>
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
