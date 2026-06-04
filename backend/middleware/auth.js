import jwt from 'jsonwebtoken';

const authUser = async (req,res,next) => {
    const headerToken = req.headers?.token;
    const cookieToken = req.cookies?.accessToken;
    const token = headerToken || cookieToken;
    if (!token) {
        return res.status(401).json({success:false, message: 'Unauthorized'});
    }
    try {
        const token_decode = jwt.verify(token,process.env.JWT_SECRET);
        if (token_decode?.type && token_decode.type !== "access") {
            throw new Error("Invalid token type");
        }
        if (!req.body) req.body = {};
        req.body.userId = token_decode.id;
        req.userId = token_decode.id;
        next();    
    }
     catch (error) {
        console.log(error);
        return res.status(401).json({success:false, message: error.message});
    }
}


export default authUser;
