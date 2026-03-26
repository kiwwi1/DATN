import React, { useEffect } from 'react'
import { useContext } from 'react';
import { ShopContext } from '../../context/ShopContext';
import { assets } from '../../assets/assets';
import { useLocation } from 'react-router-dom';
import { useState } from 'react';

const SearchBar = () => {
    const { search, setSearch, showSearch, setShowSearch} = useContext(ShopContext);
    const location = useLocation();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if(location.pathname.includes('collection')){
            setVisible(true);
        }
        else{
            setVisible(false);
        }
    }, [location])

  return showSearch && visible ?  (
    <div className='border-t border-b bg-gray-50 text-center'>
        <div className='inline-flex items-center justify-center border border-gray-400 px-5 py-2 rounded-full my-5 mx-3 w-3/4 sm:w-1/2'>
            <input value={search} onChange={(e)=>setSearch(e.target.value)} className='flex-1 outline-none bg-inherit text-sm' type='text' placeholder='Search'></input>
            <img className='w-4' src={assets.search_icon}></img>
        </div>
        <img onClick={()=>setShowSearch(false)} className='inline w-3 cursor-pointer' src={assets.cross_icon}></img>

    </div>
  ) : null
}

export default SearchBar