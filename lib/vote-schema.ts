import mongoose from 'mongoose';

// Author information for cFIP submissions
export interface Author {
  discordId: string;
  name: string;
  image?: string;
}

// Comment on a cFIP
export interface Comment {
  id: string;
  discordId: string;
  name: string;
  image?: string;
  text: string;
  createdAt: string;
}

// Vote option
export interface VoteOption {
  option: string;
  description: string;
  title: string;
  votes: number;
  different_people: string[];
}

export interface Vote extends mongoose.Document {
  end_date: Date;
  total_votes: number;
  hadVotes: boolean;
  createdAt: string;
  deleted: boolean;
  super_majority: boolean;
  current: boolean;
  hidden?: boolean;
  title: string;
  description: string;
  all_people_number?: number;
  votes: VoteOption[];
  
  // cFIP-specific fields
  type?: 'fip' | 'cfip';
  status?: 'draft' | 'discussion' | 'voting' | 'closed';
  author?: Author;
  authorWallet?: string;
  comments?: Comment[];
  editedAt?: string;
}

export const voteSchema = new mongoose.Schema({
  end_date: Date,
  total_votes: { type: Number, default: 0 },
  hadVotes: { type: Boolean, default: false },
  createdAt: { type: String, default: Date.now },
  super_majority: { type: Boolean, default: false },
  deleted: { type: Boolean, default: false },
  current: { type: Boolean, default: false },
  hidden: { type: Boolean, default: false },
  title: String,
  description: String,
  votes: [
    {
      option: String,
      description: String,
      title: String,
      votes: { type: Number, default: 0 },
      different_people: { type: [String], default: [] }
    }
  ],
  
  // cFIP-specific fields
  type: { type: String, enum: ['fip', 'cfip'], default: 'fip' },
  status: { type: String, enum: ['draft', 'discussion', 'voting', 'closed'], default: 'discussion' },
  author: {
    discordId: String,
    name: String,
    image: String
  },
  authorWallet: String,
  comments: [
    {
      id: String,
      discordId: String,
      name: String,
      image: String,
      text: String,
      createdAt: String
    }
  ],
  editedAt: String
});
