import type { RequestHandler } from "express";
import { AppError } from "../utils/AppError.js";
import { clearAuthCookies, setAuthCookies } from "../utils/cookies.js";
import * as authService from "../services/auth.service.js";

export const signup: RequestHandler = async (req, res, next) => {
  try {
    const session = await authService.signup(req.body);
    setAuthCookies(res, session.accessToken, session.refreshToken);
    res.status(201).json({ user: session.user });
  } catch (error) {
    next(error);
  }
};

export const signin: RequestHandler = async (req, res, next) => {
  try {
    const session = await authService.signin(req.body);
    setAuthCookies(res, session.accessToken, session.refreshToken);
    res.status(200).json({ user: session.user });
  } catch (error) {
    next(error);
  }
};

export const refresh: RequestHandler = async (req, res, next) => {
  try {
    const session = await authService.refresh(req.cookies?.refreshToken);
    setAuthCookies(res, session.accessToken, session.refreshToken);
    res.status(200).json({ user: session.user });
  } catch (error) {
    next(error);
  }
};

export const logout: RequestHandler = async (req, res, next) => {
  try {
    await authService.logout(req.cookies?.refreshToken);
    clearAuthCookies(res);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const me: RequestHandler = (req, res, next) => {
  if (!req.user) {
    next(new AppError(401, "Unauthorized"));
    return;
  }
  res.status(200).json({ user: req.user });
};
