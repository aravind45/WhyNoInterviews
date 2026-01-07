import React, { useState } from 'react';
import {
  Upload,
  FileText,
  Target,
  MessageSquare,
  Users,
  Sparkles,
  ArrowRight,
  CheckCircle,
  Zap,
} from 'lucide-react';

export default function ResumeAnalyzePage() {
  const [resumeFile, setResumeFile] = useState(null);
  const [jobDescription, setJobDescription] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setResumeFile(file);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) setResumeFile(file);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/40 to-yellow-50/30">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-400 rounded-lg flex items-center justify-center shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent">
              JobMatch AI
            </span>
          </div>
          <nav className="flex gap-6 items-center">
            <a
              href="#"
              className="text-slate-700 hover:text-amber-600 transition-colors font-medium"
            >
              🎯 Analyze Resume
            </a>
            <a href="#" className="text-slate-700 hover:text-amber-600 transition-colors">
              📄 Resume Optimizer
            </a>
            <a href="#" className="text-slate-700 hover:text-amber-600 transition-colors">
              🎒 Find Jobs
            </a>
            <a href="#" className="text-slate-700 hover:text-amber-600 transition-colors">
              🏢 Target Companies
            </a>
            <a href="#" className="text-slate-700 hover:text-amber-600 transition-colors">
              👥 Networking
            </a>
            <button className="px-4 py-2 text-slate-700 hover:text-amber-600 transition-colors">
              Log In
            </button>
            <button className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:shadow-lg transition-all font-medium">
              Sign Up
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Title Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl flex items-center justify-center shadow-md">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Why No Interviews?</h1>
          </div>
          <p className="text-lg text-slate-600 ml-15">
            Get instantly honest feedback on why your resume isn't getting callbacks
          </p>
        </div>

        {/* Main Form Card */}
        <div className="bg-white rounded-2xl shadow-xl border-2 border-amber-100 p-8 mb-8">
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Resume Upload */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">Your Resume</label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
                  isDragging
                    ? 'border-amber-500 bg-amber-50'
                    : resumeFile
                      ? 'border-green-400 bg-green-50'
                      : 'border-amber-200 hover:border-amber-400 hover:bg-amber-50'
                }`}
              >
                <input
                  type="file"
                  onChange={handleFileSelect}
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  id="resume-upload"
                />
                <label htmlFor="resume-upload" className="cursor-pointer">
                  {resumeFile ? (
                    <>
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                      <p className="text-slate-700 font-medium">{resumeFile.name}</p>
                      <p className="text-sm text-slate-500 mt-1">Click to change</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                      <p className="text-slate-700 font-medium">Drop resume or click to browse</p>
                      <p className="text-sm text-slate-500 mt-1">PDF, DOC, or DOCX</p>
                    </>
                  )}
                </label>
              </div>
            </div>

            {/* Job Description */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Job Description
              </label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the complete job description here..."
                className="w-full h-[200px] px-4 py-3 border-2 border-amber-200 rounded-xl focus:border-amber-400 focus:bg-amber-50 focus:outline-none resize-none transition-all text-slate-700 placeholder-slate-400"
              />
            </div>
          </div>

          {/* AI Model Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              AI Model (choose which LLM to analyze your resume)
            </label>
            <select className="w-full px-4 py-3 border-2 border-amber-200 rounded-xl focus:border-amber-400 focus:outline-none bg-white text-slate-700 font-medium">
              <option>Groq (Llama) (groq)</option>
              <option>GPT-4 (OpenAI)</option>
              <option>Claude (Anthropic)</option>
            </select>
          </div>

          {/* Analyze Button */}
          <button className="w-full py-4 bg-gradient-to-r from-amber-400 to-yellow-500 text-white rounded-xl font-semibold text-lg hover:shadow-2xl hover:scale-[1.02] transition-all flex items-center justify-center gap-3 group">
            <Sparkles className="w-5 h-5" />
            Analyze My Match
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* What You'll Get Section */}
        <div className="bg-gradient-to-br from-amber-500 via-orange-400 to-orange-500 rounded-2xl p-8 text-white shadow-xl">
          <h2 className="text-2xl font-bold mb-6 text-center">What You'll Get After Analysis</h2>

          <div className="grid md:grid-cols-4 gap-4">
            <div className="bg-white/20 backdrop-blur rounded-xl p-5 text-center">
              <Target className="w-10 h-10 mx-auto mb-3" />
              <h3 className="font-bold mb-1">Match Score</h3>
              <p className="text-sm text-amber-50">Instant compatibility rating</p>
            </div>

            <div className="bg-white/20 backdrop-blur rounded-xl p-5 text-center">
              <FileText className="w-10 h-10 mx-auto mb-3" />
              <h3 className="font-bold mb-1">Cover Letter</h3>
              <p className="text-sm text-amber-50">Tailored to the job</p>
            </div>

            <div className="bg-white/20 backdrop-blur rounded-xl p-5 text-center">
              <Users className="w-10 h-10 mx-auto mb-3" />
              <h3 className="font-bold mb-1">Referral Message</h3>
              <p className="text-sm text-amber-50">Network outreach template</p>
            </div>

            <div className="bg-white/20 backdrop-blur rounded-xl p-5 text-center">
              <MessageSquare className="w-10 h-10 mx-auto mb-3" />
              <h3 className="font-bold mb-1">Elevator Pitch</h3>
              <p className="text-sm text-amber-50">30-second intro</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
