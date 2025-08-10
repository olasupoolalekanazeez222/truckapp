import React, { useState } from "react";
import { Link } from "react-router-dom";

const faqData = [
  {
    question: "What is this tracking system for?",
    answer: "This system helps track journeys, showing motion and stop durations and routes.",
  },
  {
    question: "How accurate is the location tracking?",
    answer: "Accuracy depends on your device's GPS and network connection; typically it is quite precise.",
  },
  {
    question: "Can I use this on mobile devices?",
    answer: "Yes, the site is mobile-friendly and uses device GPS to track locations.",
  },
  {
    question: "How often is location updated?",
    answer: "Location is updated continuously during your journey for accurate tracking.",
  },
  {
    question: "How is motion vs non-motion determined?",
    answer: "The system measures if you’ve moved at least 10 meters since last update to consider it motion.",
  },
  {
    question: "Can I view past journeys?",
    answer: "Yes, the log page displays stored journey data saved locally.",
  },
  {
    question: "What if I refresh the page during a journey?",
    answer: "Journey state is saved automatically and restored on reload.",
  },
  {
    question: "Do I need an internet connection?",
    answer: "An internet connection is required to load Google Maps and Places APIs.",
  },
  {
    question: "Is my location data stored securely?",
    answer: "Location data is stored only locally in your browser's storage.",
  },
  {
    question: "How do I contact support?",
    answer: "Please contact us at support@abccompany.com for assistance.",
  },
];

const Home = () => {
  const [openIndexes, setOpenIndexes] = useState([]);

  const toggleFaq = (index) => {
    setOpenIndexes((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  return (
    <>
      {/* FontAwesome CDN */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
      />
      <style>{`
        :root {
          --company-color: #007BFF;
        }

        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          margin: 0;
          padding: 20px;
          background: #f9fafd;
          color: #333;
        }

        header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 40px;
          flex-wrap: wrap;
        }

        header h1 {
          color: var(--company-color);
          font-weight: 700;
          font-size: 2rem;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        nav {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }

        nav a {
          color: var(--company-color);
          font-weight: 600;
          text-decoration: none;
          font-size: 1.1rem;
          transition: color 0.3s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        nav a:hover {
          color: #004a99;
        }

        main {
          max-width: 900px;
          margin: 0 auto;
        }

        .card {
          background: white;
          border: 2px solid var(--company-color);
          box-shadow: 0 4px 8px rgb(0 0 0 / 0.1);
          border-radius: 10px;
          padding: 20px;
          margin-bottom: 30px;
          transition: box-shadow 0.3s ease;
        }
        .card:hover {
          box-shadow: 0 8px 16px rgb(0 0 0 / 0.15);
        }

        .card h2 {
          color: var(--company-color);
          margin-top: 0;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 1.5rem;
        }

        .card p {
          line-height: 1.5;
          margin-bottom: 20px;
          font-size: 1rem;
        }

        .btn {
          background: var(--company-color);
          color: white;
          border: none;
          padding: 12px 25px;
          border-radius: 6px;
          font-size: 1rem;
          cursor: pointer;
          font-weight: 600;
          transition: background-color 0.3s ease;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          justify-content: center;
        }
        .btn:hover {
          background: #004a99;
        }

        /* FAQ Section */
        .faq {
          background: white;
          border: 2px solid var(--company-color);
          box-shadow: 0 4px 8px rgb(0 0 0 / 0.1);
          border-radius: 10px;
          padding: 20px;
        }
        .faq h2 {
          color: var(--company-color);
          margin-top: 0;
          margin-bottom: 20px;
          font-size: 1.6rem;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .faq-item {
          border-bottom: 1px solid #ddd;
        }
        .faq-item:last-child {
          border-bottom: none;
        }

        .faq-question {
          cursor: pointer;
          padding: 12px 0;
          font-weight: 600;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 1rem;
        }

        .faq-answer {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.3s ease, padding 0.3s ease;
          padding: 0 0;
          font-size: 0.95rem;
          line-height: 1.4;
          color: #444;
        }

        .faq-answer.open {
          max-height: 300px;
          padding: 10px 0;
        }

        .faq-question .fa-chevron-down {
          transition: transform 0.3s ease;
        }
        .faq-question.open .fa-chevron-down {
          transform: rotate(180deg);
        }

        /* Responsive */
        @media (max-width: 900px) {
          main {
            padding: 0 15px;
          }
        }
        @media (max-width: 600px) {
          body {
            padding: 15px 10px;
          }
          header {
            justify-content: center;
            gap: 15px;
          }
          header h1 {
            font-size: 1.7rem;
          }
          nav {
            justify-content: center;
            gap: 15px;
            width: 100%;
          }
          nav a {
            font-size: 1rem;
            gap: 4px;
          }
          .card {
            padding: 15px;
          }
          .card h2 {
            font-size: 1.3rem;
          }
          .card p {
            font-size: 0.95rem;
          }
          .btn {
            width: 100%;
            justify-content: center;
            font-size: 1rem;
            padding: 12px 0;
          }
          .faq h2 {
            font-size: 1.4rem;
          }
          .faq-question {
            font-size: 0.95rem;
          }
          .faq-answer {
            font-size: 0.9rem;
          }
        }
      `}</style>

      <header>
        <h1>
          <i className="fas fa-building"></i> Abc
        </h1>
        <nav>
          <Link to="/map">
            <i className="fas fa-map-marked-alt"></i> Map
          </Link>
          <Link to="/log">
            <i className="fas fa-file-alt"></i> Log
          </Link>
        </nav>
      </header>

      <main>
        <div className="card" id="mapInstructions">
          <h2>
            <i className="fas fa-map"></i> How to Use the Map
          </h2>
          <p>
            Enter your current location, pickup, and dropoff points. Start your
            journey to see real-time tracking and route on the map.
          </p>
          <Link to="/map" className="btn">
            <i className="fas fa-location-arrow"></i> Go to Map
          </Link>
        </div>

        <div className="card" id="logInstructions">
          <h2>
            <i className="fas fa-file-invoice"></i> How to Use the Log File
          </h2>
          <p>
            View detailed logs of your journey including motion and non-motion
            durations, stored in easy-to-read format.
          </p>
          <Link to="/log" className="btn">
            <i className="fas fa-file-alt"></i> Go to Log
          </Link>
        </div>

        <div className="faq">
          <h2>
            <i className="fas fa-question-circle"></i> Frequently Asked
            Questions
          </h2>

          {faqData.map(({ question, answer }, index) => {
            const isOpen = openIndexes.includes(index);
            return (
              <div key={index} className="faq-item">
                <div
                  className={`faq-question ${isOpen ? "open" : ""}`}
                  onClick={() => toggleFaq(index)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      toggleFaq(index);
                    }
                  }}
                >
                  {question}
                  <i className="fas fa-chevron-down"></i>
                </div>
                <div className={`faq-answer ${isOpen ? "open" : ""}`}>
                  {answer}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
};

export default Home;
