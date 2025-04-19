import  { createContext } from 'react';
import { products } from '../assets/assets';

export const ShopContext = createContext();

const ShopContextProvider = (props) => {

    const currency = '.000 VND';
    const delivery_fee = 30000;


    const value = {
        products , currency, delivery_fee
    }

    return(   
        <ShopContext.Provider value={value}>
            {props.children}
        </ShopContext.Provider>
    )
}
export default ShopContextProvider;