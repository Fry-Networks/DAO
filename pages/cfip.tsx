// pages/cfip.tsx
// Public page for community members to submit and vote on CFIPs

import { Card, Title, Text, Button, Flex, Badge, Tab, TabGroup, TabList, TabPanel, TabPanels, Callout, Textarea, ProgressBar } from '@tremor/react';
import { Dialog, DialogPanel, Divider, TextInput } from '@tremor/react';
import { useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { CFIP, CFIPStatus, CFIP_CONFIG } from '../lib/cfip-schema';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import clientPromise from '../lib/mongoclient';

interface CFIPWithMeta extends CFIP { _id: string; myVote?: 'promote' | 'reject' | null; community_votes: { promote: number; reject: number; voterCount?: number; }; }
interface UserEligibility { isServerMember: boolean; accountAgeDays: number; membershipDays: number; canSubmit: boolean; canVote: boolean; reasons: string[]; }

const statusColors: Record<CFIPStatus, string> = { draft: 'gray', pending_review: 'yellow', community_voting: 'blue', approved_for_fip: 'emerald', rejected: 'red', vetoed: 'rose', promoted: 'green' };
const statusLabels: Record<CFIPStatus, string> = { draft: 'Draft', pending_review: 'Under Review', community_voting: 'Voting Open', approved_for_fip: 'Community Approved', rejected: 'Rejected', vetoed: 'Vetoed', promoted: 'Promoted to FIP' };

export default function CFIPPublicPage({ initialCFIPs, serverInviteUrl }: { initialCFIPs: CFIPWithMeta[]; serverInviteUrl: string }) {
  const { data: session, status } = useSession();
  const [cfips, setCFIPs] = useState<CFIPWithMeta[]>(initialCFIPs);
  const [selectedCFIP, setSelectedCFIP] = useState<CFIPWithMeta | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitForm, setSubmitForm] = useState({ title: '', description: '' });
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [votingLoading, setVotingLoading] = useState<string | null>(null);
  const [eligibility, setEligibility] = useState<UserEligibility | null>(null);

  const isDiscordUser = session?.user && (session.user as any).provider === 'discord';

  useEffect(() => { if (isDiscordUser) fetchEligibility(); }, [isDiscordUser]);

  const fetchEligibility = async () => { try { const response = await fetch('/api/cfip/eligibility'); if (response.ok) { const data = await response.json(); setEligibility(data); } } catch (error) { console.error('Error fetching eligibility:', error); } };
  const refreshCFIPs = async () => { try { const response = await fetch('/api/cfip/list?includeMyVote=true'); if (response.ok) { const data = await response.json(); setCFIPs(data.cfips); } } catch (error) { console.error('Error refreshing CFIPs:', error); } };

  const handleSubmit = async () => {
    if (!submitForm.title.trim() || !submitForm.description.trim()) { setFeedback({ type: 'error', message: 'Title and description are required' }); return; }
    setLoading(true);
    try {
      const response = await fetch('/api/cfip/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submitForm) });
      const data = await response.json();
      if (response.ok) { setFeedback({ type: 'success', message: data.message }); setShowSubmitModal(false); setSubmitForm({ title: '', description: '' }); await refreshCFIPs(); }
      else { if (data.action === 'join_server') { setFeedback({ type: 'warning', message: `${data.message}. Join here: ${serverInviteUrl}` }); } else { setFeedback({ type: 'error', message: data.message }); } }
    } catch (error) { setFeedback({ type: 'error', message: 'An error occurred while submitting' }); } finally { setLoading(false); }
  };

  const handleVote = async (cfipId: string, vote: 'promote' | 'reject') => {
    if (!isDiscordUser) { setFeedback({ type: 'error', message: 'Please sign in with Discord to vote' }); return; }
    setVotingLoading(cfipId);
    try {
      const response = await fetch('/api/cfip/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cfipId, vote }) });
      const data = await response.json();
      if (response.ok) { await refreshCFIPs(); if (selectedCFIP?._id === cfipId) { const updated = cfips.find(c => c._id === cfipId); if (updated) setSelectedCFIP({ ...updated, myVote: vote }); } }
      else { if (data.action === 'join_server') { setFeedback({ type: 'warning', message: `${data.message}. Join here: ${serverInviteUrl}` }); } else { setFeedback({ type: 'error', message: data.message }); } }
    } catch (error) { setFeedback({ type: 'error', message: 'An error occurred while voting' }); } finally { setVotingLoading(null); }
  };

  useEffect(() => { if (feedback) { const timer = setTimeout(() => setFeedback(null), 8000); return () => clearTimeout(timer); } }, [feedback]);

  const calculateProgress = (cfip: CFIPWithMeta) => { const total = cfip.community_votes.promote + cfip.community_votes.reject; if (total === 0) return 50; return (cfip.community_votes.promote / total) * 100; };
  const getTimeRemaining = (endDate: Date | null) => { if (!endDate) return null; const now = new Date(); const end = new Date(endDate); const diff = end.getTime() - now.getTime(); if (diff <= 0) return 'Voting ended'; const days = Math.floor(diff / (1000 * 60 * 60 * 24)); const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)); if (days > 0) return `${days}d ${hours}h remaining`; return `${hours}h remaining`; };

  const renderEligibilityStatus = () => {
    if (!isDiscordUser || !eligibility) return null;
    return (
      <Card className="mb-4">
        <Flex justifyContent="between" alignItems="center">
          <div>
            <Text className="font-semibold mb-1">Your Eligibility Status</Text>
            <div className="text-sm text-gray-600 space-y-1">
              <div>{eligibility.isServerMember ? '✅' : '❌'} Fry Networks Server Member</div>
              <div>{eligibility.accountAgeDays >= CFIP_CONFIG.MIN_DISCORD_ACCOUNT_AGE_DAYS ? '✅' : '⚠️'} Account Age: {Math.floor(eligibility.accountAgeDays)} days (need {CFIP_CONFIG.MIN_DISCORD_ACCOUNT_AGE_DAYS})</div>
              <div>{eligibility.membershipDays >= CFIP_CONFIG.MIN_SERVER_MEMBERSHIP_DAYS ? '✅' : '⚠️'} Server Membership: {Math.floor(eligibility.membershipDays)} days (need {CFIP_CONFIG.MIN_SERVER_MEMBERSHIP_DAYS})</div>
            </div>
          </div>
          <div className="text-right">{eligibility.canVote ? <Badge color="green" size="lg">Eligible to Participate</Badge> : <Badge color="yellow" size="lg">Not Yet Eligible</Badge>}</div>
        </Flex>
      </Card>
    );
  };

  const renderCFIPCard = (cfip: CFIPWithMeta) => {
    const isVoting = cfip.status === 'community_voting';
    const progress = calculateProgress(cfip);
    const totalVotes = cfip.community_votes.promote + cfip.community_votes.reject;
    return (
      <Card key={cfip._id} className="mb-4 hover:shadow-md transition-shadow">
        <Flex justifyContent="between" alignItems="start">
          <div className="flex-1">
            <Flex justifyContent="start" alignItems="center" className="gap-2 mb-2">
              <Badge color={statusColors[cfip.status]}>{statusLabels[cfip.status]}</Badge>
              <Text className="text-xs text-gray-500">by {cfip.author.discordUsername}</Text>
              {isVoting && cfip.voting_end && <Text className="text-xs text-gray-500">⏱ {getTimeRemaining(cfip.voting_end)}</Text>}
            </Flex>
            <Title className="cursor-pointer hover:text-blue-600" onClick={() => setSelectedCFIP(cfip)}>{cfip.title}</Title>
            <Text className="mt-2 line-clamp-2 text-gray-600">{cfip.description.substring(0, 200)}...</Text>
            {isVoting && (
              <div className="mt-4">
                <Flex justifyContent="between" className="mb-1">
                  <Text className="text-sm"><span className="text-green-600 font-semibold">{cfip.community_votes.promote}</span> Promote</Text>
                  <Text className="text-sm"><span className="text-red-600 font-semibold">{cfip.community_votes.reject}</span> Reject</Text>
                </Flex>
                <ProgressBar value={progress} color="emerald" className="mt-1" />
                <Text className="text-xs text-gray-500 mt-1">{totalVotes} total votes • Need {CFIP_CONFIG.MIN_VOTES_REQUIRED} minimum • {CFIP_CONFIG.PROMOTE_THRESHOLD_PERCENT}% to pass</Text>
              </div>
            )}
          </div>
          {isVoting && isDiscordUser && eligibility?.canVote && (
            <Flex flexDirection="col" className="gap-2 ml-4">
              <Button size="xs" color={cfip.myVote === 'promote' ? 'green' : 'gray'} variant={cfip.myVote === 'promote' ? 'primary' : 'secondary'} onClick={() => handleVote(cfip._id, 'promote')} loading={votingLoading === cfip._id} disabled={votingLoading !== null}>👍 Promote</Button>
              <Button size="xs" color={cfip.myVote === 'reject' ? 'red' : 'gray'} variant={cfip.myVote === 'reject' ? 'primary' : 'secondary'} onClick={() => handleVote(cfip._id, 'reject')} loading={votingLoading === cfip._id} disabled={votingLoading !== null}>👎 Reject</Button>
            </Flex>
          )}
        </Flex>
      </Card>
    );
  };

  const votingCFIPs = cfips.filter(c => c.status === 'community_voting');
  const approvedCFIPs = cfips.filter(c => c.status === 'approved_for_fip');
  const promotedCFIPs = cfips.filter(c => c.status === 'promoted');
  const userDiscordId = session?.user ? (session.user as any).providerAccountId : null;
  const myCFIPs = cfips.filter(c => c.author.discordId === userDiscordId);

  return (
    <main className="p-4 md:p-10 mx-auto max-w-5xl">
      <Flex justifyContent="between" alignItems="center" className="mb-6">
        <div><Title>Community Proposals (CFIPs)</Title><Text>Submit and vote on Community Fry Improvement Proposals</Text></div>
        {!session ? (
          <Button onClick={() => signIn('discord')} color="indigo">Sign in with Discord</Button>
        ) : isDiscordUser ? (
          <Button onClick={() => setShowSubmitModal(true)} disabled={!eligibility?.canSubmit}>+ Submit CFIP</Button>
        ) : (
          <Button onClick={() => signIn('discord')} color="indigo" variant="secondary">Switch to Discord</Button>
        )}
      </Flex>

      {feedback && <Callout className="mb-4" title={feedback.type === 'success' ? 'Success' : feedback.type === 'warning' ? 'Notice' : 'Error'} color={feedback.type === 'success' ? 'teal' : feedback.type === 'warning' ? 'yellow' : 'red'}>{feedback.message}</Callout>}

      {!isDiscordUser && <Callout className="mb-4" title="Discord Required" color="blue">Sign in with Discord to submit proposals and vote on CFIPs. You must be a member of the <a href={serverInviteUrl} target="_blank" rel="noopener noreferrer" className="underline">Fry Networks Discord server</a>.</Callout>}

      {renderEligibilityStatus()}

      <Card className="mb-4 bg-gray-50">
        <Text className="font-semibold mb-2">Participation Requirements</Text>
        <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
          <li>Must be a member of the Fry Networks Discord server</li>
          <li>Discord account must be at least {CFIP_CONFIG.MIN_DISCORD_ACCOUNT_AGE_DAYS} days old</li>
          <li>Must be a server member for at least {CFIP_CONFIG.MIN_SERVER_MEMBERSHIP_DAYS} days</li>
          <li>Maximum {CFIP_CONFIG.MAX_SUBMISSIONS_PER_WINDOW} submissions per week</li>
        </ul>
        <Text className="text-sm text-gray-500 mt-2">Note: CFIPs that pass community voting may be promoted to official FIPs, which use on-chain stake-weighted voting.</Text>
      </Card>

      <TabGroup>
        <TabList>
          <Tab>Open Voting ({votingCFIPs.length})</Tab>
          <Tab>Community Approved ({approvedCFIPs.length})</Tab>
          <Tab>Promoted to FIP ({promotedCFIPs.length})</Tab>
          {isDiscordUser && <Tab>My CFIPs ({myCFIPs.length})</Tab>}
        </TabList>
        <TabPanels>
          <TabPanel>{votingCFIPs.length > 0 ? votingCFIPs.map(renderCFIPCard) : <Text className="text-gray-500 py-8 text-center">No CFIPs currently open for voting</Text>}</TabPanel>
          <TabPanel>{approvedCFIPs.length > 0 ? approvedCFIPs.map(renderCFIPCard) : <Text className="text-gray-500 py-8 text-center">No community-approved CFIPs pending promotion</Text>}</TabPanel>
          <TabPanel>{promotedCFIPs.length > 0 ? promotedCFIPs.map(renderCFIPCard) : <Text className="text-gray-500 py-8 text-center">No CFIPs have been promoted to official FIPs yet</Text>}</TabPanel>
          {isDiscordUser && <TabPanel>{myCFIPs.length > 0 ? myCFIPs.map(renderCFIPCard) : <Text className="text-gray-500 py-8 text-center">You haven't submitted any CFIPs yet</Text>}</TabPanel>}
        </TabPanels>
      </TabGroup>

      {/* CFIP Detail Modal */}
      <Dialog open={!!selectedCFIP} onClose={() => setSelectedCFIP(null)}>
        <DialogPanel className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
          {selectedCFIP && (
            <>
              <Flex justifyContent="between" className="mb-4">
                <Flex className="gap-2">
                  <Badge color={statusColors[selectedCFIP.status]}>{statusLabels[selectedCFIP.status]}</Badge>
                  {selectedCFIP.status === 'community_voting' && selectedCFIP.voting_end && <Badge color="gray">{getTimeRemaining(selectedCFIP.voting_end)}</Badge>}
                </Flex>
                <button onClick={() => setSelectedCFIP(null)}>✕</button>
              </Flex>
              <Title>{selectedCFIP.title}</Title>
              <Text className="text-sm text-gray-500 mb-4">Submitted by {selectedCFIP.author.discordUsername} on {new Date(selectedCFIP.created_at).toLocaleDateString()}</Text>
              {selectedCFIP.status === 'community_voting' && (
                <div className="mb-4">
                  <ProgressBar value={calculateProgress(selectedCFIP)} color="emerald" />
                  <Flex justifyContent="between" className="mt-2">
                    <Text className="text-green-600">{selectedCFIP.community_votes.promote} Promote</Text>
                    <Text className="text-red-600">{selectedCFIP.community_votes.reject} Reject</Text>
                  </Flex>
                  {isDiscordUser && eligibility?.canVote && (
                    <Flex justifyContent="center" className="gap-4 mt-4">
                      <Button color={selectedCFIP.myVote === 'promote' ? 'green' : 'gray'} variant={selectedCFIP.myVote === 'promote' ? 'primary' : 'secondary'} onClick={() => handleVote(selectedCFIP._id, 'promote')} loading={votingLoading === selectedCFIP._id}>👍 Promote to FIP</Button>
                      <Button color={selectedCFIP.myVote === 'reject' ? 'red' : 'gray'} variant={selectedCFIP.myVote === 'reject' ? 'primary' : 'secondary'} onClick={() => handleVote(selectedCFIP._id, 'reject')} loading={votingLoading === selectedCFIP._id}>👎 Reject</Button>
                    </Flex>
                  )}
                </div>
              )}
              <Divider />
              <div className="prose max-w-none mt-4" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(selectedCFIP.description) as string) }} />
            </>
          )}
        </DialogPanel>
      </Dialog>

      {/* Submit CFIP Modal */}
      <Dialog open={showSubmitModal} onClose={() => setShowSubmitModal(false)}>
        <DialogPanel className="sm:max-w-2xl">
          <Title className="mb-4">Submit a Community Proposal</Title>
          <Text className="text-gray-600 mb-4">Your proposal will be reviewed by Fry Networks before being opened for community voting. If the community votes to promote it, Fry Networks will make the final decision on whether to create an official FIP.</Text>
          <div className="mb-4">
            <Text className="mb-2 font-medium">Title</Text>
            <TextInput value={submitForm.title} onChange={(e) => setSubmitForm(prev => ({ ...prev, title: e.target.value }))} placeholder="A clear, concise title for your proposal (min 10 characters)" maxLength={CFIP_CONFIG.MAX_TITLE_LENGTH} />
            <Text className="text-xs text-gray-500 mt-1">{submitForm.title.length}/{CFIP_CONFIG.MAX_TITLE_LENGTH}</Text>
          </div>
          <div className="mb-4">
            <Text className="mb-2 font-medium">Description (Markdown supported)</Text>
            <Textarea value={submitForm.description} onChange={(e) => setSubmitForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Describe your proposal in detail (min 100 characters). What problem does it solve? How should it be implemented?" rows={10} />
            <Text className="text-xs text-gray-500 mt-1">{submitForm.description.length}/{CFIP_CONFIG.MAX_DESCRIPTION_LENGTH}</Text>
          </div>
          <Flex justifyContent="end" className="gap-2 mt-6">
            <Button variant="secondary" onClick={() => setShowSubmitModal(false)}>Cancel</Button>
            <Button onClick={handleSubmit} loading={loading}>Submit Proposal</Button>
          </Flex>
        </DialogPanel>
      </Dialog>
    </main>
  );
}

export async function getServerSideProps() {
  try {
    const client = await clientPromise;
    const db = client.db('main');
    const cfips = await db.collection('cfips').find({ status: { $in: ['community_voting', 'approved_for_fip', 'promoted'] } }).sort({ created_at: -1 }).limit(50).toArray();
    const sanitizedCFIPs = cfips.map((cfip: any) => ({ ...cfip, _id: cfip._id.toString(), community_votes: { promote: cfip.community_votes.promote, reject: cfip.community_votes.reject, voterCount: cfip.community_votes.voters?.length || 0 }, admin_notes: undefined }));
    return { props: { initialCFIPs: JSON.parse(JSON.stringify(sanitizedCFIPs)), serverInviteUrl: process.env.FRY_NETWORKS_DISCORD_INVITE || 'https://discord.gg/frynetworks' } };
  } catch (error) {
    console.error('Error fetching CFIPs:', error);
    return { props: { initialCFIPs: [], serverInviteUrl: process.env.FRY_NETWORKS_DISCORD_INVITE || 'https://discord.gg/frynetworks' } };
  }
}
