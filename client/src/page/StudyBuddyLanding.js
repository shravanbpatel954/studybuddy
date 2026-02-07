import React from "react";
import Navbar from "./navbar";
import styles from "./StudyBuddyLanding.module.css";
import { Upload, Brain, Zap, BookOpen } from "lucide-react";
import { motion } from "framer-motion";

export default function StudyBuddyLanding() {
  return (
    <div className={styles.landingContainer}>
      <Navbar />
      {/* Navbar */}
      {/* <motion.nav
        className={`${styles.navbar} ${styles.glass}`}
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <h1 className={styles.logo}>StudyBuddy</h1>
        <div className={styles.navLinks}>
          <a href="#features">Features</a>
          <a href="#performance">Performance</a>
          <a href="#flashcards">Flashcards</a>

          <motion.button
            className={styles.btnGlow}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <a href="Login">Get Started</a>
          </motion.button>
        </div>
      </motion.nav> */}

      {/* Hero Section */}
      <motion.section
        id="hero"
        className={`${styles.hero} ${styles.darkGradient}`}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
      >
        <motion.span
          className={styles.eyebrow}
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          All-in-one study workspace
        </motion.span>
        <motion.h2
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Learn faster with modules, AI help, and games 🚀
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Real StudyBuddy features: team modules with uploads, AI doubt solving,
          global chat, quizzes/flashcards with videos, games, and a live
          leaderboard.
        </motion.p>

        <motion.button
          className={styles.btnGlow}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <a href="Login">Try StudyBuddy Now</a>
        </motion.button>
           <Link to="/login">
               <button className="sb-btn">Get Started</button>
            </Link>

      </motion.section>

      {/* Features Section */}
      <section id="features" className={`${styles.features} ${styles.darkBg}`}>
        <h3>Why Choose StudyBuddy?</h3>
        <div className={styles.featureGrid}>
          <FeatureCard
            number="01"
            icon={<Upload size={40} color="#00e0ff" />}
            title="Module workspaces"
            text="Create modules, upload notes/PDFs, preview content, and keep everything organized in one workspace."
            delay={0.1}
          />
          <FeatureCard
            number="02"
            icon={<Brain size={40} color="#00e0ff" />}
            title="AI chat & doubts"
            text="Use the AI doubt solver or the global chat to get instant help while you study."
            delay={0.3}
          />
          <FeatureCard
            number="03"
            icon={<Zap size={40} color="#00e0ff" />}
            title="Quizzes & flashcards"
            text="Practice with quizzes and flashcards that also surface YouTube explainer videos for each concept."
            delay={0.5}
          />
          <FeatureCard
            number="04"
            icon={<BookOpen size={40} color="#00e0ff" />}
            title="Games & leaderboard"
            text="Play built-in games, earn points, and climb the realtime leaderboard with friends."
            delay={0.7}
          />
        </div>
      </section>

      {/* Performance Section */}
      <section id="performance" className={`${styles.section} ${styles.darkBg}`}>
        <div className={styles.sectionHeading}>
          <h3>Built for how StudyBuddy actually works</h3>
          <p>Points, sharing, and PWA-ready flows that mirror the live app experience.</p>
        </div>
        <div className={styles.sectionPanel}>
          <div className={styles.metricGrid}>
            <div className={`${styles.metricCard} ${styles.glass}`}>
              <h4>Points everywhere</h4>
              <p>Earn and sync points across quizzes, games, and challenges; see updates instantly on dashboard.</p>
            </div>
            <div className={`${styles.metricCard} ${styles.glass}`}>
              <h4>Collaboration ready</h4>
              <p>Share modules with codes, manage members/roles, and control enrollment without leaving the app.</p>
            </div>
            <div className={`${styles.metricCard} ${styles.glass}`}>
              <h4>PWA friendly</h4>
              <p>Install the app, get the splash screen, and jump straight to your login/dashboard when returning.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Flashcards Section */}
      <section id="flashcards" className={`${styles.section} ${styles.darkBg}`}>
        <div className={styles.sectionHeading}>
          <h3>Flashcards with context that matters</h3>
          <p>Each card can include explanations, resources, and auto-fetched YouTube videos for the topic.</p>
        </div>
        <div className={styles.sectionPanel}>
          <div className={styles.flashcardsRow}>
            <div className={`${styles.flashcardTile} ${styles.glass}`}>
              <strong>Concept + answer</strong>
              <p>See the core prompt and answer, exactly like the in-app quiz/flashcard flow.</p>
            </div>
            <div className={`${styles.flashcardTile} ${styles.glass}`}>
              <strong>Deep explanation</strong>
              <p>Attach a detailed explanation so you never forget the reasoning behind an answer.</p>
            </div>
            <div className={`${styles.flashcardTile} ${styles.glass}`}>
              <strong>Video helper</strong>
              <p>We pull a relevant YouTube video for each card to reinforce the concept quickly.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className={`${styles.contactSection} ${styles.darkBg}`}>
        <div className={styles.sectionHeading}>
          <h3>Let&apos;s connect</h3>
          <p>Reach the developer anytime for feedback, support, or collabs.</p>
        </div>

        <div className={styles.contactIcons}>
          <a className={`${styles.iconLink} ${styles.whatsapp}`} href="https://wa.me/918104479942" target="_blank" rel="noreferrer">
            <div className={styles.layer}>
              <span></span><span></span><span></span><span></span><span className={styles.fab}>WA</span>
            </div>
            <span className={styles.text}>WhatsApp</span>
          </a>
          <a className={`${styles.iconLink} ${styles.gmail}`} href="mailto:shravan.b.patel954@gmail.com" target="_blank" rel="noreferrer">
            <div className={styles.layer}>
              <span></span><span></span><span></span><span></span><span className={styles.fab}>G</span>
            </div>
            <span className={styles.text}>Gmail</span>
          </a>
          <a className={`${styles.iconLink} ${styles.linkedin}`} href="https://www.linkedin.com/in/shravan-kumar-patel/" target="_blank" rel="noreferrer">
            <div className={styles.layer}>
              <span></span><span></span><span></span><span></span><span className={styles.fab}>in</span>
            </div>
            <span className={styles.text}>LinkedIn</span>
          </a>
          <a className={`${styles.iconLink} ${styles.github}`} href="https://github.com/shravanbpatel954" target="_blank" rel="noreferrer">
            <div className={styles.layer}>
              <span></span><span></span><span></span><span></span><span className={styles.fab}>GH</span>
            </div>
            <span className={styles.text}>GitHub</span>
          </a>
        </div>
      </section>

      {/* Footer */}
      <motion.footer
        className={`${styles.footer} ${styles.glass}`}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
      >
        © {new Date().getFullYear()} StudyBuddy — Built for Smart Learners ✨
      </motion.footer>
    </div>
  );
}

function FeatureCard({ number, icon, title, text, delay }) {
  return (
    <motion.div
      className={`${styles.featureCard} ${styles.glass} ${styles.neonGlow}`}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.8 }}
      whileHover={{
        scale: 1.05,
        boxShadow: "0 0 25px rgba(0,224,255,0.6)",
      }}
      viewport={{ once: true }}
    >
      <span className={styles.featureNumber}>{number}</span>
      <div className={styles.icon}>{icon}</div>
      <h4>{title}</h4>
      <p>{text}</p>
    </motion.div>
  );
}
