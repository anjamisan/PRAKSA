import React from "react";

export const ModelIndex = {
    LLAMA: 1,
    GPT_OSS: 2,
    QWEN: 3,
    MINISTRAL: 4,
} as const;

export type ModelIndex = typeof ModelIndex[keyof typeof ModelIndex];

const ModelPicker: React.FC<{
    value: ModelIndex;
    onChange: (value: ModelIndex) => void;
}> = ({ value, onChange }) => {
    return (
        <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">Model</label>
            <select
                className="border rounded-md px-2 py-1 text-sm"
                value={value}
                onChange={(e) => onChange(Number(e.target.value) as ModelIndex)}
            >
                <option value={ModelIndex.LLAMA}>llama</option>
                <option value={ModelIndex.GPT_OSS}>gpt-oss</option>
                <option value={ModelIndex.QWEN}>qwen</option>
                <option value={ModelIndex.MINISTRAL}>ministral</option>
            </select>
        </div>
    );
};

export default ModelPicker;
