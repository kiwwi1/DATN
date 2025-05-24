import React from "react";
import { ToastContainer } from "react-toastify";
import Navbar from "./components/Navbar";
import { Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Add from "./pages/Add";
import List from "./pages/List";
import Orders from "./pages/Orders";
import Login from "./components/Login";
import { useState, useEffect } from "react";
import 'react-toastify/dist/ReactToastify.css';



export const backendUrl = import.meta.env.VITE_BACKEND_URL
export const currency = '.000 VND'
const App = () => {
  const [token, setToken] = useState(localStorage.getItem("token")?localStorage.getItem("token"):"");

  useEffect(() => {
     localStorage.setItem("token",token);
  }, [token]);

  return (
    <div className="bg-gray-50 min-h-screen">
      <ToastContainer />
      {token === "" ? (
        <Login setToken={setToken}/>
      ) : (
        <>
          <Navbar setToken={setToken}/>
          <hr></hr>
          <div className="w-full flex">
            <Sidebar />
            <div className="w-[70%] mx-auto ml-[max(5vw,25px)] my-8 text-gray-600 text-base">
              <Routes>
                <Route path="/add" element={<Add token={token}/>} />
                <Route path="/list" element={<List token={token}/>} />
                <Route path="/orders" element={<Orders token={token}/>} />
              </Routes>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
