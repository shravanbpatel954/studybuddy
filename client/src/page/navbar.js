import React, { useState } from 'react';
import { Link } from "react-router-dom";
import './navbar.css';

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => {
        setIsOpen(!isOpen);
        document.body.classList.toggle("no-scroll", !isOpen);
    };

    const scrollToSection = (id) => {
        const section = document.getElementById(id);

        if (section) {
            window.scrollTo({
                top: section.offsetTop - 70,
                behavior: "smooth"
            });
        }

        setIsOpen(false);
        document.body.classList.remove("no-scroll");
    };

    return (
        <header className="sb-header">
            <nav className="navbar">
                <div className="nav-container">

                    {/* LOGO */}
                    <span className="sb-logo">StudyBuddy</span>

                    {/* DESKTOP MENU (looks same as header) */}
                    <ul className="nav-menu-desktop">
                        <li><button className="nav-link" onClick={() => scrollToSection("features")}>Features</button></li>
                        <li><button className="nav-link" onClick={() => scrollToSection("performance")}>Performance</button></li>
                        <li><button className="nav-link" onClick={() => scrollToSection("flashcards")}>Flashcards</button></li>
                        <li>
                            <Link to="/login">
                                <button className="sb-btn">Get Started</button>
                            </Link>
                        </li>
                    </ul>

                    {/* MOBILE TOGGLE BUTTON */}
                    <div className="nav-toggle" onClick={toggleMenu}>
                        <span className="bar"></span>
                        <span className="bar"></span>
                        <span className="bar"></span>
                    </div>

                </div>

                {/* MOBILE MENU SECTION */}
                <div className={`mobile-menu ${isOpen ? "active" : ""}`}>
                    <button className="mobile-link" onClick={() => scrollToSection("features")}>Features</button>
                    <button className="mobile-link" onClick={() => scrollToSection("performance")}>Performance</button>
                    <button className="mobile-link" onClick={() => scrollToSection("flashcards")}>Flashcards</button>
                    <Link to="/login">
                        <button className="sb-btn">Get Started</button>
                    </Link>        
                </div>

            </nav>
        </header>
    );
};

export default Navbar;
