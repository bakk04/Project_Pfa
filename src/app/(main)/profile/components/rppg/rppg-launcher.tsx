'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Camera, Zap } from 'lucide-react'

export function RppgLauncher() {
  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <div className="w-12 h-12 rounded-xl bg-[#34C759]/10 flex items-center justify-center text-[#34C759] mb-4">
          <Camera size={24} strokeWidth={2.5} />
        </div>
        <h3 className="text-xl font-bold text-[#1e7e34] mb-2">Initialize Scan</h3>
        <p className="text-[#8E8E93] text-sm leading-relaxed">
          Begin a secure, high-precision analysis of your hemodynamic markers using real-time remote photoplethysmography.
        </p>
      </div>
      <motion.div className="mt-auto" whileTap={{ scale: 0.98 }}>
        <Link
          href="/monitor"
          className="w-full flex items-center justify-center gap-2 px-6 py-3 text-center text-sm font-bold bg-[#34C759] text-white rounded-xl shadow-lg shadow-[#34C759]/10 transition-all hover:bg-[#28a745]"
        >
          <Zap size={16} fill="white" />
          Activate Sensor
        </Link>
      </motion.div>
    </div>
  )
}
