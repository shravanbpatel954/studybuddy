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
        className={`${styles.hero} ${styles.darkGradient}`}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
      >
        <motion.h2
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Learn Faster. Shine Brighter. <br /> With StudyBuddy 🚀
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Your personalized AI-powered learning companion — adaptive quizzes,
          performance tracking, and interactive flashcards, all in one place.
        </motion.p>

        <motion.button
          className={styles.btnGlow}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <a href="Login">Try StudyBuddy Now</a>
        </motion.button>
      </motion.section>

      {/* Features Section */}
      <section id="features" className={`${styles.features} ${styles.darkBg}`}>
        <h3>Why Choose StudyBuddy?</h3>
        <div className={styles.featureGrid}>
          <FeatureCard
            number="01"
            icon={<Upload size={40} color="#00e0ff" />}
            title="AI Syllabus Generator"
            text="Upload or generate your syllabus instantly with our AI engine."
            delay={0.1}
          />
          <FeatureCard
            number="02"
            icon={<Brain size={40} color="#00e0ff" />}
            title="Smart Adaptive Quizzes"
            text="Test smarter, not harder. Our AI adapts to your learning speed."
            delay={0.3}
          />
          <FeatureCard
            number="03"
            icon={<Zap size={40} color="#00e0ff" />}
            title="Performance Insights"
            text="Track your mastery level and visualize your improvement."
            delay={0.5}
          />
          <FeatureCard
            number="04"
            icon={<BookOpen size={40} color="#00e0ff" />}
            title="Flashcard Mastery"
            text="Interactive and glowing flashcards that make learning fun!"
            delay={0.7}
          />
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
