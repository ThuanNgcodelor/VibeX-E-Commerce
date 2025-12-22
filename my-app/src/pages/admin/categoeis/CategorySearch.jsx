export default function CategorySearch({ value, onChange, dark = false }) {
    return (
        <input
            type="text"
            className={`form-control ${dark ? "dark-mode" : ""}`}
            placeholder="Search by name or description..."
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            aria-label="Search categories"
            style={{
                border: 'none',
                background: 'transparent',
                fontSize: '0.95rem'
            }}
        />
    );
}
