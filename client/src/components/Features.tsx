import { motion } from "motion/react";
import { Mic, Users, TrendingUp } from "lucide-react";

const features = [
  {
    icon: Mic,
    title: "Create",
    description:
      "Upload your track, pick your wolf, and get AI-generated lyrics, SRT subtitles, beat cuts, and cinematic video prompts.",
    accent: "#f5c518",
  },
  {
    icon: Users,
    title: "Connect",
    description:
      "Discover artists worldwide through the Versus swipe system. Match with collaborators who share your vibe and start creating together.",
    accent: "#9b6dff",
  },
  {
    icon: TrendingUp,
    title: "Conquer",
    description:
      "Join the Lightning Wolves roster. Get featured across territories, build your fanbase, and grow your career with real label infrastructure.",
    accent: "#69f0ae",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-wolf-gold">
            The Ecosystem
          </p>
          <h2
            className="text-3xl font-bold tracking-wider text-white md:text-5xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            HOW IT WORKS
          </h2>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              className="group rounded-2xl border border-wolf-border/30 bg-wolf-card p-8 transition-shadow hover:shadow-xl hover:shadow-black/30"
            >
              <div
                className="mb-5 inline-flex rounded-xl p-3"
                style={{ backgroundColor: `${f.accent}12` }}
              >
                <f.icon size={28} style={{ color: f.accent }} />
              </div>
              <h3
                className="mb-3 text-2xl text-white"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed text-wolf-muted">
                {f.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
