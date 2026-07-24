"use client";
import React from "react";

export const Card = ({ children, className = "", ...props }: any) => (
  <div className={`rounded-2xl p-4 bg-white ${className}`} {...props}>
    {children}
  </div>
);
export const CardHeader = ({ children, className = "", ...props }: any) => (
  <div className={`mb-3 ${className}`} {...props}>{children}</div>
);
export const CardTitle = ({ children, className = "", ...props }: any) => (
  <h3 className={`text-lg font-semibold ${className}`} {...props}>{children}</h3>
);
export const CardDescription = ({ children, className = "", ...props }: any) => (
  <p className={`text-xs mt-0.5 ${className}`} {...props}>{children}</p>
);
export const CardContent = ({ children, className = "", ...props }: any) => (
  <div className={className} {...props}>{children}</div>
);
export const CardFooter = ({ children, className = "", ...props }: any) => (
  <div className={className} {...props}>{children}</div>
);

export default Card;
