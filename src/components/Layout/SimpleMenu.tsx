import { FaArrowLeft, FaDiscord, FaHome } from 'react-icons/fa';

import { MenuItem } from '$cmp/Miscellaneous/MenuItem';
import { historyTracker } from '$stores/History';
import { homeStore } from '$stores/HomeStore';
import { useNavigate } from 'react-router-dom';

interface SimpleMenuProps {
    children?: React.ReactNode,
    className?: string
}
export function SimpleMenu({ children = undefined, className = '' }: SimpleMenuProps) {
    const navigate = useNavigate()
    return <div className={"menu-wrapper " + (className)} >
        <div className="menu menu-visible" style={{ justifyContent: 'flex-end' }}>
            {historyTracker.hasNavigated &&
                <MenuItem
                    style={{ marginBottom: 'auto' }}
                    onClick={() => {
                        navigate(-1)
                    }}
                    ariaLabel='Go back'
                >
                    <FaArrowLeft className='icon' />
                </MenuItem>
            }
            {children}
            <MenuItem ariaLabel='Go to discord'>
                <a href='https://discord.gg/Arsf65YYHq' target='_blank' rel='noreferrer' >
                    <FaDiscord className="icon" />
                </a>
            </MenuItem>

            <MenuItem onClick={homeStore.open} ariaLabel='Open home menu'>
                <FaHome className="icon" />
            </MenuItem>
        </div>
    </div>
}