import { Route, Routes, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Teacher from "./pages/Teacher";
import Host from "./pages/Host";
import Play from "./pages/Play";
import Display from "./pages/Display";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/teacher" element={<Teacher />} />
      <Route path="/host/:code" element={<Host />} />
      <Route path="/play/:code" element={<Play />} />
      <Route path="/display/:code" element={<Display />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
