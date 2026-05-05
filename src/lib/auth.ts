import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import { cacheSession, getCachedSession } from '@/lib/redis';

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      async profile(profile) {
        await dbConnect();
        const existingUser = await User.findOne({ email: profile.email });
        
        if (!existingUser) {
          throw new Error('NO_ACCOUNT_FOUND');
        }

        if (profile.picture && existingUser.profileImage !== profile.picture) {
          await User.updateOne({ _id: existingUser._id }, { profileImage: profile.picture });
          existingUser.profileImage = profile.picture;
        }

        return {
          id: existingUser._id.toString(),
          name: `${existingUser.firstName} ${existingUser.lastName}`,
          email: existingUser.email,
          image: existingUser.profileImage,
          role: existingUser.role,
          status: existingUser.status,
        };
      },
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please enter an email and password');
        }

        await dbConnect();
        const user = await User.findOne({ email: credentials.email }).select('+password');

        if (!user || !user.password) {
          throw new Error('This email does not exist');
        }

        const isPasswordMatch = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordMatch) {
          throw new Error('Invalid password');
        }

        return {
          id: user._id.toString(),
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          image: user.profileImage,
          role: user.role,
          status: user.status,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
        token.role = (user as any).role;
        token.status = (user as any).status;
        await cacheSession(`user:${user.id}`, user);
      }
      
      if (trigger === 'update' && session) {
          return { ...token, ...session.user };
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.image = token.picture as string;
        (session.user as any).role = token.role;
        (session.user as any).status = token.status;
        
        // Try to get fresh data from cache if available, but token is primary
        const cachedUser = await getCachedSession(`user:${token.id}`);
        if (cachedUser) {
          session.user = { ...session.user, ...cachedUser };
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
