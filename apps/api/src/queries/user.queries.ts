import User from "../model/user.model.js";

export interface CreateUserData {
  _id: string;
  email: string;
  firstName: string;
  lastName?: string;
  username: string;
  avatarUrl?: string;
  ssoProvider?: 'google' | 'email' | 'extension';
  subscriptionStatus?: 'active' | 'inactive' | 'cancelled' | 'free';
  subscriptionStartDate?: Date;
}

export const createUser = async (userData: CreateUserData) => {
  const user = await User.create(userData);
  return user;
};
