'use client';

import { Fragment, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Disclosure, Menu, Transition } from '@headlessui/react';
import { Bars3Icon, XMarkIcon, ClipboardIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useSession, signIn, signOut } from 'next-auth/react';
import ThemeToggle, { useTheme } from '../components/theme-toggle';
import { logoLight, logoDark } from '../components/logos';
import { useWallet } from '../lib/use-wallet-compat';

const navigation = [
  { name: 'Home', href: '/' },
  { name: 'cFIP', href: '/cfip' },
  { name: 'Vote', href: '/vote' },
  { name: 'Last Vote', href: '/lastvote' },
  { name: 'All Votes', href: '/allvotes' },
  { name: 'My Stakes', href: '/stakes' }
];

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

const truncateAddress = (addr: string) => 
  addr ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : '';

export default function Navbar() {
  const pathname = usePathname();
  const isDark = useTheme();
  const { data: session, status } = useSession();
  const { providers, activeAddress } = useWallet();
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    if (activeAddress) {
      navigator.clipboard.writeText(activeAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDisconnect = () => {
    const connectedProvider = providers?.find(p => p.isConnected);
    if (connectedProvider) {
      connectedProvider.disconnect();
    }
  };

  return (
    <Disclosure as="nav" className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
      {({ open }) => (
        <>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 justify-between">
              <div className="flex">
                <button
                  onClick={() => {
                    window.location.href = '/';
                  }}
                  className="flex items-center"
                >
                  <img
                    src={isDark ? logoLight : logoDark}
                    alt="Fry Networks"
                    className="h-8 w-auto"
                  />
                </button>
                <div className="hidden sm:-my-px sm:ml-8 sm:flex sm:space-x-6">
                  {navigation.map((item) => (
                    <a
                      key={item.name}
                      href={item.href}
                      className={classNames(
                        pathname === item.href
                          ? 'border-[#e74c3c] text-[var(--text-heading)]'
                          : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-color)]',
                        'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-150'
                      )}
                      aria-current={pathname === item.href ? 'page' : undefined}
                    >
                      {item.name}
                    </a>
                  ))}
                </div>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:items-center gap-3">
                <ThemeToggle />
                {status === 'loading' ? (
                  <div className="h-8 w-8 rounded-full bg-[var(--border-color)] animate-pulse" />
                ) : session ? (
                  <Menu as="div" className="relative ml-3">
                    <Menu.Button className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors">
                      {session.user?.image ? (
                        <img
                          src={session.user.image}
                          alt=""
                          className="h-7 w-7 rounded-full"
                        />
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-xs font-bold">
                          {session.user?.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      )}
                      <span className="hidden lg:block">{session.user?.name}</span>
                      {activeAddress && (
                        <span className="hidden lg:block text-xs text-emerald-400 ml-1">●</span>
                      )}
                    </Menu.Button>
                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-200"
                      enterFrom="transform opacity-0 scale-95"
                      enterTo="transform opacity-100 scale-100"
                      leave="transition ease-in duration-75"
                      leaveFrom="transform opacity-100 scale-100"
                      leaveTo="transform opacity-0 scale-95"
                    >
                      <Menu.Items className="absolute right-0 z-10 mt-2 w-64 origin-top-right rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] shadow-lg focus:outline-none">
                        {/* Discord identity */}
                        <div className="px-4 py-3 border-b border-[var(--border-color)]">
                          <p className="text-sm text-[var(--text-secondary)]">Signed in as</p>
                          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                            {session.user?.name}
                          </p>
                        </div>
                        
                        {/* Wallet section */}
                        <div className="px-4 py-3 border-b border-[var(--border-color)]">
                          {activeAddress ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-[var(--text-secondary)]">Wallet</span>
                                <div className="flex items-center gap-1">
                                  <code className="text-sm text-emerald-400 font-mono">{truncateAddress(activeAddress)}</code>
                                  <button 
                                    onClick={copyAddress} 
                                    className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                    title="Copy address"
                                  >
                                    {copied ? (
                                      <CheckIcon className="h-4 w-4 text-emerald-400" />
                                    ) : (
                                      <ClipboardIcon className="h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                              </div>
                              <button 
                                onClick={handleDisconnect}
                                className="w-full text-left text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] px-2 py-1.5 rounded transition-colors"
                              >
                                Disconnect Wallet
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-sm text-[var(--text-secondary)]">Wallet: Not connected</p>
                              {providers?.map(provider => (
                                <button 
                                  key={provider.metadata.id}
                                  onClick={() => provider.connect()}
                                  className="w-full flex items-center gap-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] px-2 py-1.5 rounded transition-colors"
                                >
                                  <img 
                                    src={provider.metadata.icon} 
                                    alt="" 
                                    className="h-4 w-4 rounded"
                                  />
                                  Connect {provider.metadata.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {/* Sign out */}
                        <div className="py-1">
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={() => signOut()}
                                className={classNames(
                                  active ? 'bg-[var(--bg-secondary)]' : '',
                                  'block w-full px-4 py-2 text-left text-sm text-[var(--text-primary)]'
                                )}
                              >
                                Sign out
                              </button>
                            )}
                          </Menu.Item>
                        </div>
                      </Menu.Items>
                    </Transition>
                  </Menu>
                ) : (
                  <button
                    onClick={() => signIn('discord')}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-medium text-white hover:bg-[#4752C4] transition-colors"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                    Sign in
                  </button>
                )}
              </div>
              <div className="-mr-2 flex items-center sm:hidden gap-2">
                <ThemeToggle />
                <Disclosure.Button className="inline-flex items-center justify-center rounded-lg bg-[var(--bg-secondary)] p-2 text-[var(--text-secondary)] hover:bg-[var(--border-color)] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#e74c3c] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]">
                  <span className="sr-only">Open main menu</span>
                  {open ? (
                    <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                  ) : (
                    <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                  )}
                </Disclosure.Button>
              </div>
            </div>
          </div>

          <Disclosure.Panel className="sm:hidden bg-[var(--bg-secondary)]">
            <div className="space-y-1 pt-2 pb-3">
              {navigation.map((item) => (
                <Disclosure.Button
                  key={item.name}
                  as="a"
                  href={item.href}
                  className={classNames(
                    pathname === item.href
                      ? 'bg-[var(--bg-card)] border-[#e74c3c] text-[var(--text-heading)]'
                      : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:border-[var(--border-color)] hover:text-[var(--text-primary)]',
                    'block pl-3 pr-4 py-2 border-l-4 text-base font-medium transition-colors duration-150'
                  )}
                  aria-current={pathname === item.href ? 'page' : undefined}
                >
                  {item.name}
                </Disclosure.Button>
              ))}
            </div>
            <div className="border-t border-[var(--border-color)] pt-4 pb-3">
              {session ? (
                <div className="space-y-3 px-4">
                  <div className="flex items-center gap-3">
                    {session.user?.image ? (
                      <img
                        src={session.user.image}
                        alt=""
                        className="h-10 w-10 rounded-full"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-[#5865F2] flex items-center justify-center text-white font-bold">
                        {session.user?.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {session.user?.name}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {session.user?.email}
                      </p>
                    </div>
                  </div>
                  
                  {/* Mobile wallet section */}
                  <div className="rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] p-3">
                    {activeAddress ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-[var(--text-secondary)]">Wallet</span>
                          <code className="text-sm text-emerald-400 font-mono">{truncateAddress(activeAddress)}</code>
                        </div>
                        <button 
                          onClick={handleDisconnect}
                          className="w-full text-center text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] py-1.5 rounded border border-[var(--border-color)] transition-colors"
                        >
                          Disconnect
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm text-[var(--text-secondary)]">Wallet: Not connected</p>
                        {providers?.map(provider => (
                          <Disclosure.Button 
                            key={provider.metadata.id}
                            as="button"
                            onClick={() => provider.connect()}
                            className="w-full flex items-center justify-center gap-2 text-sm text-[var(--text-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--border-color)] px-3 py-2 rounded transition-colors"
                          >
                            <img 
                              src={provider.metadata.icon} 
                              alt="" 
                              className="h-4 w-4 rounded"
                            />
                            {provider.metadata.name}
                          </Disclosure.Button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <Disclosure.Button
                    as="button"
                    onClick={() => signOut()}
                    className="w-full rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--border-color)] transition-colors"
                  >
                    Sign out
                  </Disclosure.Button>
                </div>
              ) : (
                <div className="px-4">
                  <Disclosure.Button
                    as="button"
                    onClick={() => signIn('discord')}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-medium text-white hover:bg-[#4752C4] transition-colors"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                    Sign in with Discord
                  </Disclosure.Button>
                </div>
              )}
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}
