import jwt from 'jsonwebtoken';

const authUser = async (req,res,next) => {
    const { token } = req.headers;
        if(!token){
            res.json({success:false, message: 'Unauthorized'})
        }
    try {
        const token_decode = jwt.verify(token,process.env.JWT_SECRET)
        if (!req.body) req.body = {};
        req.body.userId = token_decode.id;
        // moi lan user login se dc tao 1 token sau do khi cham den endpoint nao thi se lay token do va lay id cua user roi chuyen tiep 
        next();    
        }
     catch (error) {
        console.log(error)
        res.json({success:false, message: error.message})
    }
}


export default authUser;