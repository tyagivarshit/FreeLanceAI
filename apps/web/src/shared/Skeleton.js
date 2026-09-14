import React from "react";
export const Skeleton = ({ id, className = "", variant = "text", style, }) => {
    const variantClass = {
        text: "skeleton-text",
        card: "skeleton-card",
        row: "skeleton-row",
        avatar: "skeleton-avatar",
    }[variant];
    return (<div id={id} className={`progressive-skeleton ${variantClass} ${className}`.trim()} style={style}/>);
};
