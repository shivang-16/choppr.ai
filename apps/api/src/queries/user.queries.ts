import User from "../model/user.model.js";
import mongoose from "mongoose";

export interface CreateUserData {
  _id: string;
  email: string;
  firstName: string;
  lastName?: string;
  username: string;
  avatarUrl?: string;
  ssoProvider?: 'google' | 'email' | 'extension';
  subscriptionPlanId?: mongoose.Schema.Types.ObjectId;
  subscriptionStatus?: 'active' | 'inactive' | 'cancelled' | 'free';
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
}

export const createUser = async (userData: CreateUserData) => {
    try {
        const user = await User.create(userData);
        
        return user;
    } catch (error) {
        throw error;
    }
    
}
