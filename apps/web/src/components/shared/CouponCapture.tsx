"use client";

import { useEffect } from "react";

import { rememberCouponFromUrl } from "@/lib/coupon-link";

/** Saves ?coupon=CODE from an influencer's link on any landing page. Renders nothing. */
export default function CouponCapture() {
  useEffect(() => { rememberCouponFromUrl(); }, []);
  return null;
}
