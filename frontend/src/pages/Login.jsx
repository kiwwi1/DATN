import React from "react";
import { useState, useContext } from "react";
import { ShopContext } from "../context/ShopContext";
import axios from 'axios'
import { toast } from 'react-toastify'
import { useEffect } from 'react'

const Login = () => {
  const [currentState, setCurrentState] = useState("Login");
  const {token, setToken, navigate, backendUrl} = useContext(ShopContext)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    try {
      if(currentState === "Sign Up"){
        const response = await axios.post(backendUrl+'/api/user/register', {name, email, password})
        if(response.data.success){
          setToken(response.data.token)
          localStorage.setItem('token', response.data.token)
        } else {
          toast.error(response.data.message || 'Registration failed')
        }
      } else {
        // Login logic
        const response = await axios.post(backendUrl+'/api/user/login', {email, password})
        if(response.data.success){
          toast.success(response.data.message || 'Login successful!')
          setToken(response.data.token)
          localStorage.setItem('token', response.data.token)
          navigate('/')
        } else {
          toast.error(response.data.message || 'Login failed')
        }
      }
    } catch (error) {
      console.log(error)
      toast.error(error.message)
    }
  };

  useEffect(()=>{
    if(token){
      navigate('/')
    }
  },[token,navigate])

  return (
    <form
      onSubmit={onSubmitHandler}
      className="flex flex-col items-center w-[90%] sm:max-w-96 m-auto mt-14 gap-4 text-gray-800"
    >
      <div className="inline-flex gap-2 items-center mb-2 mt-10">
        <p className="prata-regular text-3xl">{currentState}</p>
        <hr className="border-none h-[1.5px] w-8 bg-gray-800"></hr>
      </div>
      {currentState === "Login" ? (
        ""
      ) : (
        <input
          type="text"
          className="w-full px-3 py-2 border border-gray-800"
          placeholder="Name"
          required={currentState === "Sign Up"}
          value={name}
          onChange={(e)=>setName(e.target.value)}
        ></input>
      )}
      <input
        type="email"
        className="w-full px-3 py-2 border border-gray-800"
        placeholder="Email"
        required
        value={email}
        onChange={(e)=>setEmail(e.target.value)}
      ></input>
      <input
        type="password"
        className="w-full px-3 py-2 border border-gray-800"
        placeholder="Password"
        required
        value={password}
        onChange={(e)=>setPassword(e.target.value)}
      ></input>
      <div className="w-full flex justify-between text-sm mt-[-8px]">
        <p className="cursor-pointer">Forgot your password</p>
        {currentState === "Login" ? (
          <p
            onClick={() => setCurrentState("Sign Up")}
            className="cursor-pointer"
          >
            Create Account
          </p>
        ) : (
          <p
            onClick={() => setCurrentState("Login")}
            className="cursor-pointer"
          >
            Login Here
          </p>
        )}
      </div>
      <button type="submit" className="bg-black text-white font-light px-8 py-2 mt-5">
        {currentState === "Login" ? "Login" : "Sign Up"}
      </button>
    </form>
  );
};

export default Login;
