import React from "react";



const ModelPicker: React.FC<{
    value: string;
    onChange: (value: string) => void;
}> = ({ value, onChange }) => {
    return (
        <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">Model</label>
            <select
                className="border rounded-md px-2 py-1 text-sm"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                <option value={"llama3.2:latest"}>llama</option>
                <option value={"gpt-oss:120b-cloud"}>gpt-oss</option>
                <option value={"qwen3-vl:235b-cloud"}>qwen</option>
                <option value={"ministral-3:14b-cloud"}>ministral</option>
            </select>
        </div>
    );
};

export default ModelPicker;
