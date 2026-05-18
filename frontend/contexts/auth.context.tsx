"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { AuthData, Restaurant, User } from "../types";
import { apiFetch } from "../services/api";

type AuthContextValue = {
  user: User | null;
  restaurant: Restaurant | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginAsOwner: (email: string, password: string) => Promise<void>;
  updateRestaurant: (restaurant: Restaurant) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    const storedRestaurant = localStorage.getItem("restaurant");

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser) as User);
      if (storedRestaurant) {
        setRestaurant(JSON.parse(storedRestaurant) as Restaurant);
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<AuthData>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    if (data.restaurant) {
      localStorage.setItem("restaurant", JSON.stringify(data.restaurant));
    } else {
      localStorage.removeItem("restaurant");
    }

    setToken(data.token);
    setUser(data.user);
    setRestaurant(data.restaurant || null);
  }, []);

  const loginAsOwner = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<AuthData>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    if (data.restaurant) {
      localStorage.setItem("restaurant", JSON.stringify(data.restaurant));
    } else {
      localStorage.removeItem("restaurant");
    }

    setToken(data.token);
    setUser(data.user);
    setRestaurant(data.restaurant || null);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("restaurant");
    setToken(null);
    setUser(null);
    setRestaurant(null);
  }, []);

  const updateRestaurant = useCallback((nextRestaurant: Restaurant) => {
    localStorage.setItem("restaurant", JSON.stringify(nextRestaurant));
    setRestaurant(nextRestaurant);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, restaurant, token, isLoading, login, loginAsOwner, updateRestaurant, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
