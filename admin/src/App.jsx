import React from "react";
import { ToastContainer } from "react-toastify";
import Navbar from "./components/Navbar";
import { Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Add from "./pages/Add";
import List from "./pages/List";
import Orders from "./pages/Orders";
import Login from "./components/Login";
import VendorValidator from "./components/VendorValidator";
import { useState, useEffect } from "react";
import 'react-toastify/dist/ReactToastify.css';



export const backendUrl = import.meta.env.VITE_BACKEND_URL
export const currency = '.000 VND'
const App = () => {
  const [token, setToken] = useState("");

  useEffect(() => {
    // Check for token in URL parameter (from frontend redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const vendorTokenFromUrl = urlParams.get("vendorToken");
    
    if (vendorTokenFromUrl) {
      // Save token from URL to localStorage and set state
      setToken(vendorTokenFromUrl);
      localStorage.setItem("token", vendorTokenFromUrl);
      
      // Clean up URL (remove token parameter for security)
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      // Check localStorage for existing token
      const localToken = localStorage.getItem("token");
      if (localToken) {
        setToken(localToken);
      }
    }
  }, []);

  useEffect(() => {
     if (token) {
       localStorage.setItem("token", token);
     }
  }, [token]);

  return (
    <div className="bg-gray-50 min-h-screen">
      <ToastContainer />
      {token === "" ? (
        <Login setToken={setToken}/>
      ) : (
        <VendorValidator token={token} setToken={setToken}>
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
        </VendorValidator>
      )}
    </div>
  );
};

export default App;
