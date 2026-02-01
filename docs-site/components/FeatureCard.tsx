interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="group p-6 rounded-2xl bg-tertiary/30 border border-tertiary/50 hover:border-neon-cyan/50 transition-all duration-300 hover:shadow-neon-sm card-brackets border-glow">
      <div className="text-neon-cyan mb-4 group-hover:scale-110 transition-transform duration-300 neon-flicker-slow">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-100 mb-2 group-hover:text-glow-cyan transition-all duration-300">
        {title}
      </h3>
      <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
